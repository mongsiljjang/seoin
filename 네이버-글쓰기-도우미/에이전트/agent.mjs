// ═══════════════════════════════════════════════════════════
//  네이버 글쓰기 에이전트 — 키워드 목록 → 초안 뭉치 → 워드프레스
//  실행:  node agent.mjs        (Node.js 20 이상, 설치할 것 없음)
//  ※ 프리셋 내용은 ../index.html, ../크롬확장/popup.js 와 같아야 한다.
// ═══════════════════════════════════════════════════════════
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// ── 주제 프리셋 ──────────────────────────────────────────────
const PRESETS = {
    병원: {
        persona: '이 글은 병원(의원) 공식 블로그의 정보성 글이다. 지역명과 진료과목을 조합한 키워드로 잠재 환자가 검색해 들어온다. 광고 티를 빼고, 환자가 병원에 오기 전 궁금해하는 것을 친절하게 알려주는 글로 쓴다.',
        guard: `- 치료 효과를 보장·단정하는 표현 금지: "완치", "100%", "부작용 없음", "최고", "유일", "안전성이 입증된" 등.
- 환자의 치료 경험담·후기 형식으로 쓰지 말 것 (의료광고법상 치료경험담 광고 금지).
- 치료 전후 비교(비포·애프터) 서술 금지.
- 다른 병원과의 비교·비방 금지.
- 가격·할인·이벤트 언급 금지.
- 증상·치료를 단정하지 말고 "증상과 상태에 따라 다르므로 정확한 진단은 의료진 상담이 필요합니다"를 글 안에 명시할 것.
- 의학적 수치·연구 결과는 확실한 것만 쓰고, 불확실하면 [확인 필요]로 표시할 것.`
    },
    브랜딩: {
        persona: '이 글은 병원 현장에서 오래 일한 전문가의 개인 블로그 글이다. 목적은 병원 홍보가 아니라, 현장 경험에서 나온 노하우와 관찰을 나눠 강의·자문으로 이어지는 신뢰를 쌓는 것이다. 경력은 구체적으로("병원 현장 30년" 등), 자랑이 아니라 근거로 쓴다.',
        guard: `- 특정 병원의 홍보나 내원 유도 문구를 넣지 말 것 (개인 브랜딩 글이다).
- 의학적 판단을 단정하지 말고 일반 정보와 현장 관찰의 선을 지킬 것.
- 경험은 구체적인 장면으로 쓰되, 환자를 특정할 수 있는 정보는 절대 쓰지 말 것.`
    },
    보험: {
        persona: '이 글은 기업보험 전문가가 쓰는 정보성 글이다. 보험 상품만이 아니라 사업주에게 도움이 되는 주제(위험관리, 직원 복지, 정부 지원 제도, 노무·세무 상식, 병원·사업장 운영 등)를 폭넓게 다룬다. 어떤 주제든 "사업주의 위험과 비용을 줄인다"는 관점으로 자연스럽게 연결해, 전문가에 대한 신뢰가 쌓이고 상담 문의로 이어지게 한다.',
        guard: `- 아래 보험 관련 규칙은 글이 보험을 다루는 경우에 적용할 것. 보험을 다루지 않는 글에는 해당 규칙을 억지로 끼워 넣지 말 것.
- 보장을 단정하는 표현 금지: "무조건 보장", "전액 지급", "손해 볼 일 없는" 등.
- 타사 상품에 대한 비방이나 단순 비교 금지.
- 확정되지 않은 보험금·환급률·수익률 수치를 제시하지 말 것.
- 특정 상품 권유가 아니라 제도·개념 설명 중심으로 쓸 것.
- 보험 상품을 다룬 글의 끝에는 "보장 내용은 상품과 약관에 따라 다르므로, 가입 전 상품설명서와 약관을 반드시 확인하세요" 안내 문구를 넣을 것.`
    },
    범용: {
        persona: '이 글은 해당 분야를 잘 아는 사람이 독자의 눈높이에 맞춰 쓰는 정보성 블로그 글이다.',
        guard: ''
    }
};

const TONE_PROMPTS = {
    감성: `위의 글을 다음 절대 규칙에 따라 '사람의 언어'로 해체하고 다시 써줘. 너는 10년 차 실전 마케터다.
1. '혁신적인', '뛰어난', '종합적인', '요약하자면' 같은 영혼 없는 AI식 표현은 완전히 삭제할 것.
2. 첫 문장은 반드시 원본 내용과 관련된 나의 솔직한 경험이나 의구심을 담은 1인칭 시점으로 시작할 것.
3. 문장 길이를 철저히 비대칭으로 섞을 것. 10자 이내의 짧은 단문 2개 뒤에 50자 이상의 긴 문장 1개를 배치할 것.
4. '그리고, 그래서, 하지만' 같은 접속사 사용을 80% 이상 줄일 것.
5. 원본에 있던 사실·수치·법적 안내 문구는 하나도 빼거나 바꾸지 말 것.
6. 원본과 같은 출력 형식(첫 줄 '제목: …')을 유지할 것.`,
    전문가: `위의 글을 다음 절대 규칙에 따라 전문가 칼럼 톤으로 다시 써줘.
1. 감성적 묘사와 감탄사는 배제하고, 구체적인 근거와 단호한 어조를 사용할 것.
2. 모호한 형용사 대신 검증 가능한 사실과 숫자로 말할 것. 불확실하면 [확인 필요]로 표시.
3. 서론 없이 결론부터 두괄식으로 쓸 것.
4. 문장 길이는 비대칭으로 섞되, 가벼운 유행어나 구어체는 쓰지 말 것.
5. 원본에 있던 법적 안내 문구는 그대로 유지할 것.
6. 원본과 같은 출력 형식(첫 줄 '제목: …')을 유지할 것.`,
    GEO: `위의 글을 AI 검색(GEO·AEO)에 최적화된 구조로 다시 써줘.
1. 인사말과 서론은 모두 빼고, 소제목은 질문형으로 만들고 그 바로 아래 첫 줄에 40~50단어 이내의 명확한 정답을 두괄식으로 배치할 것.
2. 메인 키워드를 반복하지 말고 관련 전문 유의어를 골고루 섞을 것.
3. 본문 중간에 반드시 3가지 불릿 포인트나 요약 표(Table)를 하나 이상 넣어 구조화할 것.
4. 원본에 있던 사실·수치·법적 안내 문구는 하나도 빼거나 바꾸지 말 것.
5. 원본과 같은 출력 형식(첫 줄 '제목: …')을 유지할 것.`
};

function buildPrompt(preset, keyword, experience) {
    const expLine = experience
        ? `- 글에 반영할 나의 실제 경험 메모: "${experience}". 이 메모를 첫 문단과 본문에 자연스럽게 녹일 것. 메모에 없는 경험이나 수치를 지어내지 말 것.`
        : `- 나의 경험 메모는 없다. 경험이 들어가야 할 자리는 문장을 지어내지 말고 [여기에 본인 경험 한 줄] 표시로 비워둘 것.`;
    const guardBlock = preset.guard
        ? `\n[반드시 지킬 법·표현 규칙 — 하나라도 어기면 글 전체를 다시 쓸 것]\n${preset.guard}\n`
        : '';

    return `너는 네이버 블로그 상위노출 글을 써 온 10년 차 실전 마케터다. 대표키워드 「${keyword}」로 블로그 글 한 편을 아래 규칙대로 작성해 줘.

[출력 형식 — 반드시 지킬 것]
- 첫 줄: "제목: " 뒤에 가장 좋은 제목 1개.
- 둘째 줄부터: 본문 (마크다운, 소제목은 ## 사용).
- 본문이 끝난 뒤 "## 다른 제목 후보" 소제목 아래 나머지 제목 후보 4개 (그중 2개 이상은 대상·상황·지역을 좁힌 세부 키워드 조합).
- 인사말, 설명, 덧붙이는 말 없이 위 형식만 출력할 것.

[글의 관점]
${preset.persona}
${guardBlock}
[본문 구조 — 순서대로]
1. 첫 문단: 1인칭 경험 한 줄로 시작하고, 이어서 이 글에서 얻어갈 것을 2~3문장 두괄식으로 요약할 것. 인사말·날씨 얘기 금지.
2. 질문형 소제목 3~4개. 각 소제목 바로 아래 첫 줄에 완결된 정답을 먼저 쓰고, 그다음 부연할 것.
3. 본문 중간에 표(Table) 또는 3가지 불릿 정리를 1개 이상 넣을 것.
4. 글의 하단부는 구체적인 이야기·관찰·시행착오 중심으로 쓸 것.
5. 사진을 넣을 자리를 (사진: 어떤 장면을 찍을지 설명) 형식으로 3곳 이상 표시할 것.
6. 글 끝에 독자가 물어볼 만한 질문과 답(FAQ) 2~3개, 해시태그 5개.

[문체·키워드 규칙]
- 대표키워드는 제목·첫 문단·소제목 중 1곳, 총 3번 안팎만 쓰고 반복하지 말 것. 대신 관련 유의어와 전문 용어를 골고루 쓸 것.
- '혁신적인', '뛰어난', '요약하자면' 같은 AI식 표현 금지. 접속사(그리고·그래서·하지만)는 최소화.
- 문장 길이를 비대칭으로 섞을 것(짧은 단문 2개 뒤에 긴 문장 1개).
- 확실하지 않은 사실·수치는 쓰지 말고 [확인 필요]로 표시할 것.
${expLine}

전체 분량은 공백 포함 1,500자 이상.`;
}

// ── 제미나이 호출 ────────────────────────────────────────────
async function callGemini(설정, prompt) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${설정.모델}:generateContent?key=${설정.제미나이키}`;
    for (let 시도 = 1; 시도 <= 3; 시도++) {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        if (res.status === 429 || res.status >= 500) {
            const 대기 = 시도 * 15;
            console.log(`  ⏳ 사용량 제한/서버 혼잡 (${res.status}). ${대기}초 쉬었다 다시 시도합니다 (${시도}/3)`);
            await sleep(대기 * 1000);
            continue;
        }
        const data = await res.json();
        if (!res.ok) {
            throw new Error(`제미나이 응답 오류 (${res.status}): ${data.error ? data.error.message : JSON.stringify(data)}`);
        }
        const parts = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        if (!parts) throw new Error(`글이 생성되지 않았습니다: ${JSON.stringify(data).slice(0, 300)}`);
        return parts.map((p) => p.text || '').join('');
    }
    throw new Error('3번 다시 시도했지만 사용량 제한이 풀리지 않았습니다. 잠시 뒤 다시 실행하세요.');
}

// ── 워드프레스 임시글 업로드 ─────────────────────────────────
function 마크다운을HTML로(md) {
    return md.split(/\n{2,}/).map((블록) => {
        const b = 블록.trim();
        if (!b) return '';
        if (b.startsWith('### ')) return `<h3>${b.slice(4)}</h3>`;
        if (b.startsWith('## ')) return `<h2>${b.slice(3)}</h2>`;
        if (b.split('\n').every((l) => /^[-*•] /.test(l.trim())))
            return `<ul>${b.split('\n').map((l) => `<li>${l.trim().slice(2)}</li>`).join('')}</ul>`;
        return `<p>${b.replace(/\n/g, '<br>')}</p>`;
    }).join('\n');
}

async function 워드프레스업로드(wp, 제목, 본문md) {
    const url = wp.주소.replace(/\/+$/, '') + '/wp-json/wp/v2/posts';
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: 'Basic ' + Buffer.from(`${wp.아이디}:${wp.응용프로그램비밀번호}`).toString('base64')
        },
        body: JSON.stringify({ title: 제목, content: 마크다운을HTML로(본문md), status: wp.발행상태 === '즉시발행' ? 'publish' : 'draft' })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`워드프레스 오류 (${res.status}): ${data.message || JSON.stringify(data).slice(0, 200)}`);
    return data.link || '(주소 확인 불가)';
}

// ── 유틸 ─────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const 오늘 = new Date().toISOString().slice(0, 10);
const 파일이름안전 = (s) => s.replace(/[\\/:*?"<>|]/g, ' ').trim().slice(0, 40);

// ── 메인 ─────────────────────────────────────────────────────
async function main() {
    const 설정 = JSON.parse(fs.readFileSync(path.join(DIR, '설정.json'), 'utf8'));

    if (!설정.제미나이키) {
        console.log(`
❗ 제미나이 API 키가 비어 있습니다. 딱 두 단계면 됩니다:

  1. https://aistudio.google.com/apikey 에 구글 계정으로 로그인 → [API 키 만들기]
  2. 발급된 키를 복사해서 이 폴더의 설정.json 안 "제미나이키": "" 따옴표 사이에 붙여넣기

  (제미나이 앱 유료 구독과는 별개입니다. API는 쓴 만큼 과금되며 글 한 편에 몇십 원 수준입니다.)
`);
        process.exit(1);
    }

    const 줄들 = fs.readFileSync(path.join(DIR, '키워드.txt'), 'utf8')
        .split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));

    if (줄들.length === 0) {
        console.log('❗ 키워드.txt 에 처리할 키워드가 없습니다. 한 줄에 하나씩 적어주세요.');
        process.exit(1);
    }

    const 초안폴더 = path.join(DIR, '초안');
    fs.mkdirSync(초안폴더, { recursive: true });

    console.log(`📝 ${줄들.length}개 키워드 처리 시작 (모델: ${설정.모델})\n`);
    let 성공 = 0, 실패 = 0;

    for (const [i, 줄] of 줄들.entries()) {
        const [키워드, 프리셋명, 경험, 톤명] = 줄.split('|').map((s) => (s || '').trim());
        const preset = PRESETS[프리셋명 || 설정.기본프리셋] || PRESETS.범용;
        const 톤 = TONE_PROMPTS[톤명 || 설정.기본톤] ? (톤명 || 설정.기본톤) : null;

        console.log(`[${i + 1}/${줄들.length}] 「${키워드}」 (프리셋: ${프리셋명 || 설정.기본프리셋}${톤 ? ', 톤: ' + 톤 : ''})`);
        try {
            let 글 = await callGemini(설정, buildPrompt(preset, 키워드, 경험));
            if (톤) {
                console.log('  🔁 톤 변환 중...');
                글 = await callGemini(설정, 글 + '\n\n---\n' + TONE_PROMPTS[톤]);
            }

            const 제목줄 = 글.match(/^제목\s*[:：]\s*(.+)$/m);
            const 제목 = 제목줄 ? 제목줄[1].trim() : 키워드;
            const 본문 = 제목줄 ? 글.replace(제목줄[0], '').trim() : 글.trim();

            const 파일 = path.join(초안폴더, `${오늘}_${파일이름안전(키워드)}.md`);
            fs.writeFileSync(파일, `# ${제목}\n\n${본문}\n`);
            console.log(`  ✅ 저장: ${path.relative(DIR, 파일)}`);

            if (설정.워드프레스 && 설정.워드프레스.사용) {
                const 링크 = await 워드프레스업로드(설정.워드프레스, 제목, 본문);
                console.log(`  🌐 워드프레스 ${설정.워드프레스.발행상태 === '즉시발행' ? '발행' : '임시글'} 완료: ${링크}`);
            }
            성공++;
        } catch (e) {
            console.log(`  ❌ 실패: ${e.message}`);
            실패++;
        }
        if (i < 줄들.length - 1) await sleep((설정.글사이대기초 || 3) * 1000);
    }

    console.log(`\n끝. 성공 ${성공} · 실패 ${실패}`);
    console.log('발행 전 체크: ① [여기에 본인 경험 한 줄] 채우기 ② [확인 필요] 확인 ③ (사진: …) 자리에 직접 찍은 사진');
}

main().catch((e) => { console.error('실행 오류:', e.message); process.exit(1); });
