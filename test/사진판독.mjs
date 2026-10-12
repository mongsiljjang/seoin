/* 수첩 사진 판독 시험 — 서버 함수(api/scan.js)와 앱 쪽 연결을, 실제 AI 서비스를 부르지 않고 돌려 본다.

   무엇을 보나: 키가 없으면 켜지지 않았다고 답하는지, 직원이 아니면 거절하는지, 하루 한도, 이름 가리기(성·끝 글자만 남김),
   주민번호·전화번호 지우기, 수첩 줄 모양으로 정리되는지, 사진은 저장·로그하지 않는지, 앱 쪽 버튼과 압축 크기 계산.
   돌리는 법:  node test/사진판독.mjs        (설치 필요 없음) */
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const scan = require('../api/scan.js');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const apiSrc = fs.readFileSync(new URL('../api/scan.js', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function grab(name){
  const i = js.indexOf('function '+name+'(');
  if(i<0) throw new Error(`index.html 에 ${name} 이 없다`);
  let d=0;
  for(let k=js.indexOf('{', i); k<js.length; k++){
    if(js[k]==='{') d++; else if(js[k]==='}' && --d===0) return js.slice(i, k+1);
  }
  throw new Error(name+' 의 끝을 못 찾았다');
}
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };

// 가짜 응답 상자
const mkRes = () => { const r={headers:{}}; r.setHeader=(k,v)=>{r.headers[k]=v}; r.status=c=>{r.code=c; return r}; r.json=o=>{r.body=o; return r}; return r; };
const PNG = 'data:image/jpeg;base64,' + 'A'.repeat(200);
const call = async (body, env={}, fetchImpl) => {
  const saved={...process.env}; Object.assign(process.env, env);
  const savedFetch=globalThis.fetch; if(fetchImpl) globalThis.fetch=fetchImpl;
  const res=mkRes(); try { await scan({method:'POST', body}, res); } finally { globalThis.fetch=savedFetch; process.env=saved; }
  return res;
};
const tokenFor = uid => 'x.' + Buffer.from(JSON.stringify({user_id:uid})).toString('base64') + '.y';
const fakeFetch = (memberStatus, aiText, calls=[]) => async (url, opt) => {
  calls.push({url, opt});
  if(String(url).includes('firestore.googleapis.com')) return {status:memberStatus, ok:memberStatus===200};
  return {ok:true, status:200, json:async()=>({content:[{type:'text', text:aiText}]})};
};

// 1) 이름 가리기
t('김민수 → 김ㅁ수', scan.maskName('김민수')==='김ㅁ수');
t('두 글자는 성만 남긴다: 김수 → 김ㅅ', scan.maskName('김수')==='김ㅅ');
t('네 글자: 남궁민수 → 남ㄱㅁ수', scan.maskName('남궁민수')==='남ㄱㅁ수');
t('서버의 가리기 규칙이 앱과 같다(같은 입력, 같은 결과)', (()=>{ const app=new Function("const CHO='ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';"+grab('chosung')+grab('maskName')+'; return maskName;')(); return ['김민수','박소영','김수','남궁민수','이','','김ㅁ수'].every(n=>app(n)===scan.maskName(n)); })());

// 2) 줄 정리
const raw = ['```', '1. 10/12 김민수 보험 #46 오스템 4.0*12', '- 박소영 일반 #21,22 덴티움 3.5*10', '보험 #47 오스템 4.0*10 페일', '010-1234-5678 메모', '오늘 날씨 맑음', '김ㅁ수 #46 2차수술 오스템 Ø4.5 GH3', '```'].join('\n');
const lines = scan.cleanLines(raw);
t('치식이나 규격이 있는 줄만 남는다(메모·낙서는 버린다)', lines.length===4 && !lines.some(l=>l.includes('날씨')));
t('글머리·번호는 떼고 날짜(10/12)는 그대로 둔다', lines[0].startsWith('10/12 ') && !lines[0].startsWith('1.'));
t('모델이 이름을 그대로 적어도 서버가 다시 가린다', lines[0]==='10/12 김민수 보험 #46 오스템 4.0*12'.replace('김민수','김ㅁ수') || lines[0].includes('김ㅁ수'));
t('이름이 없는 줄(보험으로 시작)은 건드리지 않는다', lines.includes('보험 #47 오스템 4.0*10 페일'));
t('이미 가려진 이름은 그대로', lines.includes('김ㅁ수 #46 2차수술 오스템 Ø4.5 GH3'));
t('전화번호·주민번호처럼 보이는 숫자는 지운다', !scan.cleanLines('900101-1234567 김민수 #46 오스템 4.0*12')[0].includes('1234567') && !scan.cleanLines('김민수 #46 오스템 4.0*12 010-1234-5678')[0].includes('5678'));
t('가린 뒤 원래 가운데 글자(민·소)가 줄에 남지 않는다', !lines.join('\n').includes('민') && !lines.join('\n').includes('소영'));

// 3) 서버 함수
{ const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u1')}, {ANTHROPIC_API_KEY:'', GEMINI_API_KEY:''}); t('키가 없으면 503 not_configured', r.code===503 && r.body.error==='not_configured'); }
{ const r=await call({image:'hello'}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:''}); t('이미지가 아니면 400', r.code===400 && r.body.error==='bad_image'); }
{ const r=await call({image:'data:image/jpeg;base64,'+'A'.repeat(3_300_000), ws:'hosp1', idToken:'t'}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:''}); t('너무 큰 사진은 413', r.code===413); }
{ const calls=[]; const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u1')}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:''}, fakeFetch(403,'x',calls));
  t('직원이 아니면(공유 문서를 못 읽으면) 403이고 AI 를 부르지 않는다', r.code===403 && !calls.some(c=>String(c.url).includes('anthropic'))); }
{ scan._resetLimit(); const calls=[]; const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u1')}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:'', SCAN_MODEL_ANTHROPIC:'m1'}, fakeFetch(200, '김민수 보험 #46 오스템 4.0*12', calls));
  t('직원이면 200 과 가린 줄을 돌려준다', r.code===200 && r.body.lines[0]==='김ㅁ수 보험 #46 오스템 4.0*12');
  const ai=calls.find(c=>String(c.url).includes('anthropic')); const body=JSON.parse(ai.opt.body);
  t('AI 에는 키·모델·사진(base64)·가리기 지시가 간다', ai.opt.headers['x-api-key']==='k' && body.model==='m1' && body.messages[0].content[0].source.data.length===200 && body.system.includes('초성'));
  t('사용자 토큰은 Firestore 확인에만 쓰고 AI 쪽으로 보내지 않는다', !ai.opt.body.includes(tokenFor('u1')) && !JSON.stringify(ai.opt.headers).includes('Bearer')); }
{ scan._resetLimit(); let last; for(let i=0;i<4;i++) last=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u2')}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:'', SCAN_PER_DAY:'3'}, fakeFetch(200,'박소영 #46 오스템 4.0*12'));
  t('하루 한도(여기서는 3장)를 넘으면 429', last.code===429 && last.body.error==='daily_limit'); }
{ scan._resetLimit(); const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u3')}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:''}, async url=>String(url).includes('firestore')? {status:200,ok:true} : {ok:false,status:500});
  t('AI 서비스가 실패하면 502', r.code===502 && r.body.error==='vendor_error'); }
{ const res=mkRes(); await scan({method:'PUT'}, res); t('POST·GET 이 아니면 405', res.code===405); }
{ const saved=process.env.ANTHROPIC_API_KEY; process.env.ANTHROPIC_API_KEY=''; process.env.GEMINI_API_KEY=''; const r1=mkRes(); await scan({method:'GET'}, r1); process.env.ANTHROPIC_API_KEY='k'; const r2=mkRes(); await scan({method:'GET'}, r2); delete process.env.GEMINI_API_KEY; if(saved===undefined) delete process.env.ANTHROPIC_API_KEY; else process.env.ANTHROPIC_API_KEY=saved;
  t('GET 은 켜져 있는지만 알려 준다(키가 없으면 false, 있으면 true, 키 값은 안 나온다)', r1.body.enabled===false && r2.body.enabled===true && !JSON.stringify(r2.body).includes('k"')); }
t('서버 함수는 사진·글자를 로그에 남기지 않는다(console 사용 없음)', !/console\./.test(apiSrc));
{ const r=mkRes(); await scan({method:'PUT'}, r); t('응답은 캐시하지 않는다(no-store)', r.headers['Cache-Control']==='no-store'); }

// 4) 앱 쪽 연결
t('수첩 화면에 사진 올리기 버튼과 안내(AI 로 읽음 · 저장 안 함 · 이름 가림)가 있다', js.includes('noteScanFile(') && js.includes('📷 사진으로 올리기') && js.includes('저장하지 않아요') && js.includes('AI'));
t('결과는 수첩 확인 표(noteRead)로 넘기고 바로 재고에 넣지 않는다', (()=>{ const s=js.slice(js.indexOf('async function noteScanFile'), js.indexOf('function noteSet(')); return s.includes('noteRead()') && !s.includes('noteSaveAll'); })());
t('서버가 켜지지 않았을 때(503)·직원 아님(403)·한도(429) 안내가 있다', ['not_configured','not_member','daily_limit'].every(k=>js.includes(k)) || (js.includes('503') && js.includes('403') && js.includes('429')));
t('사진은 올리기 전에 줄인다(긴 변 1600, JPEG)', (()=>{ const f=new Function(grab('scanTarget')+'; return scanTarget;')(); const a=f(4000,3000,1600), b=f(1000,800,1600), c=f(3000,4000,1600); return a.w===1600 && a.h===1200 && b.w===1000 && b.h===800 && c.w===1200 && c.h===1600; })());

// 두 길을 고를 수 있다 — 글로 붙여넣기 / 사진으로 올리기
t('수첩 화면 맨 위에서 글로 붙여넣기와 사진으로 올리기를 고를 수 있다', js.includes('id="noteSeg"') && js.includes("setNoteMode('text')") && js.includes("setNoteMode('photo')") && js.includes('function setNoteMode(m)'));
t('고른 길을 기억한다(다음에 열면 그대로)', js.includes("localStorage.setItem('noteMode',m)") && js.includes("localStorage.getItem('noteMode')"));
t('AI 사진 읽기가 꺼져 있으면(서버에 키가 없으면) 사진 버튼을 끄고 글로 붙여넣기를 안내한다', js.includes("fetch('/api/scan')") && js.includes('AI 사진 읽기가 아직 꺼져 있어요') && js.includes("setNoteMode('text')"));
t('글 붙여넣기 쪽에 사진에서 글자 복사하는 법(아이폰·안드로이드·PC) 안내(i)가 있다', (()=>{ const f=new Function(grab('noteCopyGuideHtml')+'; return noteCopyGuideHtml();')(); const x=f.replace(/<[^>]+>/g,' '); return ['아이폰','안드로이드','PC','복사','붙여넣기','AI 서비스 없이'].every(s=>x.includes(s)); })());

// 5) 여러 AI 서비스 · 내 키 · 라벨
const NOKEY={ANTHROPIC_API_KEY:'', GEMINI_API_KEY:''};
t('서비스 고르기: 요청의 내 키가 먼저, 없으면 서버 키(둘 다 있으면 gemini, SCAN_PROVIDER 가 있으면 그쪽)', (()=>{
  const p=scan.pickProvider;
  return p('anthropic','K',{}).provider==='anthropic' && p('anthropic','K',{}).own===true && p('', 'K',{}).provider==='gemini'
    && p('', '', {GEMINI_API_KEY:'g', ANTHROPIC_API_KEY:'a'}).provider==='gemini' && p('', '', {GEMINI_API_KEY:'g', ANTHROPIC_API_KEY:'a', SCAN_PROVIDER:'anthropic'}).provider==='anthropic'
    && p('', '', {ANTHROPIC_API_KEY:'a'}).provider==='anthropic' && p('', '', {})===null; })());
{ scan._resetLimit(); const calls=[]; const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('g1')}, {GEMINI_API_KEY:'gk', ANTHROPIC_API_KEY:'', SCAN_MODEL_GEMINI:'gm'}, async (url,opt)=>{ calls.push({url:String(url),opt}); if(String(url).includes('firestore')) return {status:200,ok:true}; return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'김민수 보험 #46 오스템 4.0*12'}]}}]})}; });
  const g=calls.find(c=>c.url.includes('generativelanguage')); const body=g&&JSON.parse(g.opt.body);
  t('Gemini 로 부르면 모델 주소·키 머리·사진·가리기 지시가 맞게 가고 줄이 돌아온다', r.code===200 && r.body.provider==='gemini' && r.body.lines[0]==='김ㅁ수 보험 #46 오스템 4.0*12' && g.url.includes('/models/gm:generateContent') && g.opt.headers['x-goog-api-key']==='gk' && body.contents[0].parts[0].inlineData.data.length===200 && body.systemInstruction.parts[0].text.includes('초성')); }
{ scan._resetLimit(); const calls=[]; let last;
  for(let i=0;i<7;i++) last=await call({image:PNG, ws:'hosp1', idToken:tokenFor('own1'), provider:'gemini', userKey:'MYKEY'}, NOKEY, async (url,opt)=>{ calls.push({url:String(url),opt}); if(String(url).includes('firestore')) return {status:200,ok:true}; return {ok:true,status:200,json:async()=>({candidates:[{content:{parts:[{text:'박소영 #46 오스템 4.0*12'}]}}]})}; });
  t('내 키를 실어 보내면 서버 키가 없어도 되고(503 아님) 서버 하루 한도에도 안 걸린다', last.code===200 && calls.filter(c=>c.url.includes('generativelanguage')).length===7 && calls.find(c=>c.url.includes('generativelanguage')).opt.headers['x-goog-api-key']==='MYKEY'); }
{ const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('own2'), provider:'gemini', userKey:'BAD'}, NOKEY, async url=>String(url).includes('firestore')? {status:200,ok:true} : {ok:false,status:403});
  t('내 키가 틀리면(AI 서비스가 403) vendor_auth 로 알려 준다', r.code===502 && r.body.error==='vendor_auth'); }
{ const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('own3'), provider:'gemini', userKey:'FREE'}, NOKEY, async url=>String(url).includes('firestore')? {status:200,ok:true} : {ok:false,status:429});
  t('무료 한도를 다 쓴 키(429)는 vendor_quota 로 알려 준다', r.code===502 && r.body.error==='vendor_quota'); }
{ const r=await call({image:PNG, ws:'hosp1', idToken:'x', userKey:'MYKEY'}, NOKEY, async url=>({status:403,ok:false}));
  t('내 키가 있어도 직원이 아니면 403(남의 요금으로 쓰는 열린 문이 되지 않게)', r.code===403); }
const NL=String.fromCharCode(10);
t('라벨 읽기: LOT·REF·EXP 만 뽑고, ? 가 섞인 값과 모양이 이상한 값은 버린다', (()=>{ const a=scan.parseLabel(['LOT: ABC-2301X45','REF: TSIII4010','EXP: 2028-06-30'].join(NL)); const b=scan.parseLabel(['LOT: AB?123','EXP: 2028/06/30','REF: ','LOT: x'].join(NL)); return a.lot==='ABC-2301X45' && a.ref==='TSIII4010' && a.exp==='2028-06-30' && Object.keys(b).length===0; })());
{ scan._resetLimit(); const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('lb1'), mode:'label'}, {ANTHROPIC_API_KEY:'k', GEMINI_API_KEY:''}, fakeFetch(200,['LOT: ZX9981','EXP: 2027-12-31'].join(NL)));
  t('라벨 모드는 label 객체를 돌려주고 수첩 줄 정리를 거치지 않는다', r.code===200 && r.body.label.lot==='ZX9981' && r.body.label.exp==='2027-12-31' && r.body.lines===undefined); }
t('서버 함수는 사용자 키를 로그·저장하지 않는다(console 사용 없음)', !/console./.test(apiSrc));

// 6) 제품 바코드(GS1)에서 LOT·유효기한 — AI 서비스 없이
const GS = String.fromCharCode(29);
const gs1 = new Function("const pad=n=>String(n).padStart(2,'0');" + grab('parseGS1') + '; return parseGS1;')();
t('괄호 있는 GS1 글: (01)GTIN(17)유효기한(10)LOT', (()=>{ const g=gs1('(01)08800012345678(17)280630(10)ABC2301X45'); return g.gtin==='08800012345678' && g.exp==='2028-06-30' && g.lot==='ABC2301X45'; })());
t('괄호 없는 GS1 글(구분자 GS): 고정 길이 뒤에 LOT, 가변은 GS 에서 끊긴다', (()=>{ const g=gs1('01088000123456781728063010ABC2301X45'+GS+'21SN001'); return g.lot==='ABC2301X45' && g.serial==='SN001' && g.exp==='2028-06-30'; })());
t('LOT 가 17 보다 앞에 와도 읽는다(10 → GS → 17)', (()=>{ const g=gs1('01088000123456781024X77B'+GS+'17270131'); return g.lot==='24X77B' && g.exp==='2027-01-31'; })());
t('기호 식별자(]d2)를 떼고 읽는다', gs1(']d2(10)LOT99').lot==='LOT99');
t('유효기한의 일이 00 이면 그 달 마지막 날', gs1('(17)280200(10)A1').exp==='2028-02-29' && gs1('(17)270200(10)A1').exp==='2027-02-28');
t('GS1 이 아닌 글·빈 글에서는 LOT 를 만들지 않는다(그때 AI 로 넘어간다)', !gs1('HELLO WORLD').lot && !gs1('').lot && !gs1(null).lot);
t('이상한 글자가 든 LOT(공백·한글)나 20자를 넘는 LOT 는 버린다', !gs1('(10)AB CD').lot && !gs1('(10)가나다').lot && !gs1('(10)'+'A'.repeat(21)).lot);

// 7) 앱 쪽: 내 키 · LOT 📷 · 오류 안내
t('수첩 사진 칸에 내 AI 키 칸이 있고, 키는 이 기기에만 저장한다고 안내한다', js.includes('id="scanOwnBox"') && js.includes('이 기기 안에만') && js.includes("localStorage.setItem('scanKey',key)") && js.includes('공용 PC에는 넣지 마세요'));
t('구글 무료 키의 학습 사용 주의가 화면에 있다', js.includes('구글 무료 키 주의') && js.includes('유료 키'));
t('요청에 내 키·서비스를 실어 보내고 서버에 저장하지 않는다(scanCall)', (()=>{ const s=js.slice(js.indexOf('async function scanCall'), js.indexOf('function scanErr')); return s.includes('body.userKey=own.key') && s.includes('body.provider=own.prov') && !s.includes('localStorage.setItem'); })());
t('수첩 사진도 LOT 사진도 같은 호출(scanCall)을 쓴다', js.includes("scanCall('note', file)") && js.includes("scanCall('label', f)"));
t('LOT 입력칸 세 곳(규격 창·입고/사용 창·케이스 치아 줄)에 📷 버튼이 있다', (js.match(/onclick="lotScan\(this\)"/g)||[]).length===3);
t('LOT 읽기 순서: 바코드(AI 없이) → AI(라벨 모드) → 직접 적기 안내', (()=>{ const s=js.slice(js.indexOf('function lotScan'), js.indexOf('function noteSet')); const a=s.indexOf('lotFromBarcode'), b=s.indexOf("scanCall('label'"), c=s.indexOf('직접 적어 주세요'); return a>0 && b>a && c>a; })());
t('읽은 LOT 는 눈으로 확인하라고 알려 준다(AI 가 읽은 경우)', js.includes('AI가 읽음 — 눈으로 확인하세요'));
t('키 오류(vendor_auth)·무료 한도(vendor_quota)·직원 아님·한도 초과를 사람 말로 안내한다', ['vendor_auth','vendor_quota','병원 직원으로 승인된 기기','사진 한도'].every(s=>js.includes(s)));
t('내 키가 있으면 서버가 꺼져 있어도 AI 사진 읽기를 켜진 것으로 본다', js.includes('(DEMO || scanOwn().key) ? true : noteAiOn'));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
