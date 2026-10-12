/* 수첩·라벨 사진 판독 — 버셀 서버 함수 (docs/SERVER.md 6장)

   앱 → (이 함수) → AI 서비스.  AI 서비스는 둘 중 고른다: Google Gemini · Anthropic Claude.
   키는 세 가지 길로 들어온다(위에서부터 먼저):
     ① 요청에 실린 "내 키" — 병원(사용자)이 자기 키를 자기 기기에 넣어 쓴다. 이 함수는 받아서 쓰기만 하고 저장하지도 로그에 남기지도 않는다.
     ② 서버 환경변수 GEMINI_API_KEY / ANTHROPIC_API_KEY — 운영자 키.
   요금은 키 주인에게 청구된다. 그래서 ①을 쓰면 운영자는 요금도 키 보관도 맡지 않는다.

   - 사진은 읽은 뒤 바로 버린다. 저장하지 않고 로그에도 남기지 않는다(환자 이름이 찍힐 수 있다).
   - 수첩 모드: 이름은 AI 에게 성과 마지막 글자만 남기고 가운데는 초성으로 적으라고 시키고, 여기서 한 번 더 가린다.
     주민번호·전화번호처럼 보이는 숫자는 결과에서 지운다. 생년월일은 옮기지 않는다.
   - 라벨 모드: 임플란트 상자·라벨에서 LOT·REF·유효기한만 읽는다(환자 정보 없음).
   - 로그인한 병원 직원만 쓴다 — 앱이 보낸 사용자 토큰으로 Firestore 의 공유 문서를 읽어 보고, 보안규칙이 허락하면 통과시킨다.
   - 결과는 앱의 확인 표/칸으로 들어가고, 사람이 보고 넘기기 전에는 재고에 반영되지 않는다.

   환경변수:  GEMINI_API_KEY · ANTHROPIC_API_KEY (둘 다 선택 — 하나도 없고 요청에 키도 없으면 꺼진 것)
              SCAN_PROVIDER (gemini | anthropic — 비우면 키가 있는 쪽, 둘 다 있으면 gemini)
              SCAN_MODEL_GEMINI (기본 gemini-2.5-flash) · SCAN_MODEL_ANTHROPIC (기본 claude-sonnet-5-5)
              FIREBASE_PROJECT_ID (기본 hospital-d0819) · SCAN_PER_DAY (서버 키 사용자별 하루 한도, 기본 5 — 서버가 다시 뜨면 0 으로 돌아가는 임시 장치) */

const MODEL_DEFAULTS = { gemini: 'gemini-2.5-flash', anthropic: 'claude-sonnet-5-5' };
const PROJECT_DEFAULT = 'hospital-d0819';
const MAX_IMAGE_B64 = 3_200_000;          // 버셀 요청 본문 한도(4.5MB) 안쪽
const BRANDS = ['오스템', '메가젠', '네오', '디오', '덴티움', '스트라우만', '신흥', '덴티스', '메디톡스'];
const KEYWORDS = ['보험', '일반', '비급여', '페일', '실패', '1차', '2차', '1차수술', '2차수술'];
const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';

function chosung(ch) { const c = ch.charCodeAt(0) - 0xAC00; return (c >= 0 && c < 11172) ? CHO[Math.floor(c / 588)] : ch; }
// 앱의 maskName 과 같은 규칙 — 성과 마지막 글자는 그대로, 가운데만 초성. 두 글자는 성만 남긴다.
function maskName(name) {
  const a = [...String(name || '').replace(/\s/g, '')]; if (!a.length) return '';
  if (a.length === 1) return a[0];
  if (a.length === 2) return a[0] + chosung(a[1]);
  return a[0] + a.slice(1, -1).map(chosung).join('') + a[a.length - 1];
}

const SYSTEM_PROMPT = [
  '당신은 치과 임플란트 수술 수첩 사진을 한 줄씩 옮겨 적는 도구입니다.',
  '사진에 보이는 수술 기록을 아래 형식의 텍스트 줄로만 출력하세요. 설명, 머리말, 번호, 마크다운은 쓰지 않습니다.',
  '',
  '형식(한 줄에 한 건):  [날짜] 이름 보험|일반 #치식[,치식] 브랜드 규격 [2차수술 힐링규격] [페일]',
  '예:  10/12 김ㅁ수 보험 #46 오스템 4.0*12',
  '예:  박ㅅ영 일반 #21,22 덴티움 3.5*10',
  '예:  김ㅁ수 #46 2차수술 오스템 Ø4.5 GH3',
  '',
  '규칙:',
  '- 날짜는 M/D 또는 YYYY-MM-DD 로 적고, 사진에 날짜가 없으면 생략합니다.',
  '- 이름은 성과 마지막 글자만 그대로 두고 가운데 글자는 초성(ㄱ ㄴ ㄷ …)으로 바꿔 적습니다. 두 글자 이름은 성만 두고 끝 글자를 초성으로 바꿉니다. 김민수 → 김ㅁ수, 김수 → 김ㅅ. 이름 전체를 그대로 적지 마세요.',
  '- 같은 환자의 다음 줄은 이름을 비워도 됩니다.',
  '- 치식은 두 자리 숫자(11~48)이고 #을 붙입니다. 규격은 4.0*12 처럼 숫자*숫자입니다.',
  '- 생년월일, 주민등록번호, 전화번호, 주소는 사진에 있어도 절대 옮기지 않습니다.',
  '- 글자를 읽을 수 없으면 추측하지 말고 그 자리에 ? 를 적습니다.',
  '- 수술 기록이 아닌 메모나 낙서는 건너뜁니다. 기록이 하나도 없으면 아무것도 출력하지 않습니다.'
].join('\n');

const LABEL_PROMPT = [
  '당신은 의료기기(치과 임플란트) 상자나 라벨 사진에서 제품 식별 정보를 읽는 도구입니다.',
  '아래 세 줄 형식으로만 출력하세요. 다른 설명은 쓰지 않습니다. 없는 항목은 줄을 빼세요.',
  'LOT: 로트(제조번호) — 보이는 글자와 숫자를 그대로, 대소문자와 하이픈도 그대로',
  'REF: 제품 번호(REF, 카탈로그 번호)',
  'EXP: 유효기한 YYYY-MM-DD',
  '글자를 읽을 수 없으면 추측하지 말고 그 자리에 ? 를 적습니다. 환자 정보는 라벨에 없지만 있어도 옮기지 않습니다.'
].join('\n');

// 모델이 낸 글을 수첩 줄로 정리한다 — 장식을 떼고, 이름을 다시 가리고, 개인정보처럼 보이는 숫자를 지운다
function cleanLines(text) {
  const out = [];
  String(text || '').split(/\r?\n/).forEach(raw => {
    let line = raw.trim().replace(/^(?:[-*•>]+\s+|\d+[.)]\s+)/, '').replace(/`/g, '').trim();   // 글머리·번호만 뗀다(10/12 같은 날짜는 그대로)
    if (!line || line.length > 140) return;
    line = line.replace(/\d{6}\s*-\s*[1-4]\d{6}/g, '').replace(/01[016789]\s*-?\s*\d{3,4}\s*-?\s*\d{4}/g, '').trim();
    if (!/[#]|\d+(\.\d+)?\s*[x×X*]\s*\d/.test(line)) return;            // 치식이나 규격이 없는 줄은 기록이 아니다
    const toks = line.split(/\s+/);
    // 이름은 치식(#) 앞에 나오는 한글 낱말 하나다(날짜·보험/일반·브랜드는 건너뛴다). 이미 가려진 것(김ㅁ수)은 그대로 둔다
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      if (t[0] === '#') break;
      if (/^[가-힣ㄱ-ㅎ]{2,5}$/.test(t) && !KEYWORDS.includes(t) && !BRANDS.includes(t)) { toks[i] = maskName(t); break; }
    }
    out.push(toks.join(' '));
  });
  return out;
}

// 라벨 읽기 결과 — LOT·REF·EXP 한 줄씩. 모양이 이상한 값은 버린다(? 가 섞였으면 못 읽은 것이다)
function parseLabel(text) {
  const r = {};
  String(text || '').split(/\r?\n/).forEach(raw => {
    const m = /^\s*(LOT|REF|EXP)\s*[:：]\s*(.+?)\s*$/i.exec(raw.replace(/[`*]/g, ''));
    if (!m) return;
    const k = m[1].toUpperCase(), v = m[2].trim();
    if (v.includes('?')) return;
    if (k === 'LOT' && /^[A-Za-z0-9][A-Za-z0-9._\/-]{2,29}$/.test(v)) r.lot = v;
    else if (k === 'REF' && /^[A-Za-z0-9][A-Za-z0-9._\/ -]{1,39}$/.test(v)) r.ref = v;
    else if (k === 'EXP' && /^\d{4}-\d{2}-\d{2}$/.test(v)) r.exp = v;
  });
  return r;
}

function parseDataUrl(s) {
  const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(s || ''));
  return m ? { type: m[1], data: m[2] } : null;
}

const hits = new Map();                    // 사용자 → { day, n } — 임시 한도. 서버가 새로 뜨면 사라진다
function overLimit(uid, perDay) {
  const day = new Date().toISOString().slice(0, 10), h = hits.get(uid);
  if (!h || h.day !== day) { hits.set(uid, { day, n: 1 }); return false; }
  if (h.n >= perDay) return true;
  h.n++; return false;
}

// 병원 직원인지 — 사용자 토큰으로 공유 문서를 읽어 본다. 보안규칙이 허락해야 읽힌다.
async function isMember(idToken, ws, project) {
  if (!idToken || !/^[A-Za-z0-9_-]{4,64}$/.test(String(ws || ''))) return false;
  const url = 'https://firestore.googleapis.com/v1/projects/' + project + '/databases/(default)/documents/hospapp/' + ws + '/shared/main';
  try { const r = await fetch(url, { headers: { Authorization: 'Bearer ' + idToken } }); return r.status === 200; }
  catch (e) { return false; }
}
function uidOf(idToken) {                  // 한도 칸 이름에만 쓴다(검증은 isMember 가 한다)
  try { return JSON.parse(Buffer.from(String(idToken).split('.')[1], 'base64').toString('utf8')).user_id || 'x'; } catch (e) { return 'x'; }
}

// 어떤 AI 서비스를 어떤 키로 부를지 — 요청에 실린 내 키가 먼저, 없으면 서버 키
function pickProvider(userProv, userKey, env) {
  if (userKey) {
    const p = userProv === 'anthropic' ? 'anthropic' : 'gemini';
    return { provider: p, key: String(userKey).trim(), own: true };
  }
  const want = env.SCAN_PROVIDER;
  const g = env.GEMINI_API_KEY, a = env.ANTHROPIC_API_KEY;
  if (want === 'anthropic' && a) return { provider: 'anthropic', key: a, own: false };
  if (want === 'gemini' && g) return { provider: 'gemini', key: g, own: false };
  if (g) return { provider: 'gemini', key: g, own: false };
  if (a) return { provider: 'anthropic', key: a, own: false };
  return null;
}

async function askAI(pick, img, system, userText, env) {
  if (pick.provider === 'gemini') {
    const model = env.SCAN_MODEL_GEMINI || MODEL_DEFAULTS.gemini;
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': pick.key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ inlineData: { mimeType: img.type, data: img.data } }, { text: userText }] }],
        generationConfig: { maxOutputTokens: 1500, temperature: 0, thinkingConfig: { thinkingBudget: 0 } }
      })
    });
    if (!r.ok) throw Object.assign(new Error('vendor'), { status: r.status });
    const j = await r.json();
    const parts = ((j.candidates || [])[0] || {}).content;
    return ((parts && parts.parts) || []).map(p => p.text || '').join('\n');
  }
  const model = env.SCAN_MODEL_ANTHROPIC || MODEL_DEFAULTS.anthropic;
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': pick.key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model, max_tokens: 1500, system,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: img.type, data: img.data } },
        { type: 'text', text: userText }] }]
    })
  });
  if (!r.ok) throw Object.assign(new Error('vendor'), { status: r.status });
  const j = await r.json();
  return (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
}

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const env = process.env;
  if (req.method === 'GET') {                 // 앱이 사진 버튼을 켤지 정하려고 묻는다 — 키는 알려 주지 않는다
    const p = pickProvider('', '', env);
    return res.status(200).json({ enabled: !!p, provider: p ? p.provider : null });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b) return res.status(400).json({ error: 'bad_request' });
  const pick = pickProvider(b.provider, b.userKey, env);
  if (!pick) return res.status(503).json({ error: 'not_configured' });
  const img = parseDataUrl(b.image);
  if (!img) return res.status(400).json({ error: 'bad_image' });
  if (img.data.length > MAX_IMAGE_B64) return res.status(413).json({ error: 'too_big' });
  const project = env.FIREBASE_PROJECT_ID || PROJECT_DEFAULT;
  if (!(await isMember(b.idToken, b.ws, project))) return res.status(403).json({ error: 'not_member' });
  if (!pick.own) {                            // 운영자 키는 한도를 건다. 내 키는 그 키 주인이 알아서 쓴다
    const perDay = Math.max(1, parseInt(env.SCAN_PER_DAY || '5', 10) || 5);
    if (overLimit(uidOf(b.idToken), perDay)) return res.status(429).json({ error: 'daily_limit', perDay });
  }
  const label = b.mode === 'label';
  let text;
  try {
    text = await askAI(pick, img, label ? LABEL_PROMPT : SYSTEM_PROMPT,
      label ? '이 사진에서 LOT, REF, 유효기한을 읽어 주세요.' : '이 수첩 사진을 규칙대로 옮겨 적어 주세요.', env);
  } catch (e) {
    if (e && e.status) {
      if (e.status === 400 || e.status === 401 || e.status === 403) return res.status(502).json({ error: 'vendor_auth', status: e.status, provider: pick.provider });
      if (e.status === 429) return res.status(502).json({ error: 'vendor_quota', status: 429, provider: pick.provider });
      return res.status(502).json({ error: 'vendor_error', status: e.status, provider: pick.provider });
    }
    return res.status(502).json({ error: 'vendor_unreachable' });
  }
  return res.status(200).json(label ? { label: parseLabel(text), provider: pick.provider } : { lines: cleanLines(text), provider: pick.provider });
}

module.exports = handler;
module.exports.cleanLines = cleanLines;
module.exports.parseLabel = parseLabel;
module.exports.maskName = maskName;
module.exports.parseDataUrl = parseDataUrl;
module.exports.pickProvider = pickProvider;
module.exports.SYSTEM_PROMPT = SYSTEM_PROMPT;
module.exports.LABEL_PROMPT = LABEL_PROMPT;
module.exports._resetLimit = () => hits.clear();
