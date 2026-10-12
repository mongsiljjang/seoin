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
{ const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u1')}, {ANTHROPIC_API_KEY:''}); t('키가 없으면 503 not_configured', r.code===503 && r.body.error==='not_configured'); }
{ const r=await call({image:'hello'}, {ANTHROPIC_API_KEY:'k'}); t('이미지가 아니면 400', r.code===400 && r.body.error==='bad_image'); }
{ const r=await call({image:'data:image/jpeg;base64,'+'A'.repeat(3_300_000), ws:'hosp1', idToken:'t'}, {ANTHROPIC_API_KEY:'k'}); t('너무 큰 사진은 413', r.code===413); }
{ const calls=[]; const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u1')}, {ANTHROPIC_API_KEY:'k'}, fakeFetch(403,'x',calls));
  t('직원이 아니면(공유 문서를 못 읽으면) 403이고 AI 를 부르지 않는다', r.code===403 && !calls.some(c=>String(c.url).includes('anthropic'))); }
{ scan._resetLimit(); const calls=[]; const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u1')}, {ANTHROPIC_API_KEY:'k', SCAN_MODEL:'m1'}, fakeFetch(200, '김민수 보험 #46 오스템 4.0*12', calls));
  t('직원이면 200 과 가린 줄을 돌려준다', r.code===200 && r.body.lines[0]==='김ㅁ수 보험 #46 오스템 4.0*12');
  const ai=calls.find(c=>String(c.url).includes('anthropic')); const body=JSON.parse(ai.opt.body);
  t('AI 에는 키·모델·사진(base64)·가리기 지시가 간다', ai.opt.headers['x-api-key']==='k' && body.model==='m1' && body.messages[0].content[0].source.data.length===200 && body.system.includes('초성'));
  t('사용자 토큰은 Firestore 확인에만 쓰고 AI 쪽으로 보내지 않는다', !ai.opt.body.includes(tokenFor('u1')) && !JSON.stringify(ai.opt.headers).includes('Bearer')); }
{ scan._resetLimit(); let last; for(let i=0;i<4;i++) last=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u2')}, {ANTHROPIC_API_KEY:'k', SCAN_PER_DAY:'3'}, fakeFetch(200,'박소영 #46 오스템 4.0*12'));
  t('하루 한도(여기서는 3장)를 넘으면 429', last.code===429 && last.body.error==='daily_limit'); }
{ scan._resetLimit(); const r=await call({image:PNG, ws:'hosp1', idToken:tokenFor('u3')}, {ANTHROPIC_API_KEY:'k'}, async url=>String(url).includes('firestore')? {status:200,ok:true} : {ok:false,status:500});
  t('AI 서비스가 실패하면 502', r.code===502 && r.body.error==='vendor_error'); }
{ const res=mkRes(); await scan({method:'GET'}, res); t('POST 가 아니면 405', res.code===405); }
t('서버 함수는 사진·글자를 로그에 남기지 않는다(console 사용 없음)', !/console\./.test(apiSrc));
{ const r=mkRes(); await scan({method:'GET'}, r); t('응답은 캐시하지 않는다(no-store)', r.headers['Cache-Control']==='no-store'); }

// 4) 앱 쪽 연결
t('수첩 화면에 사진 올리기 버튼과 안내(AI 로 읽음 · 저장 안 함 · 이름 가림)가 있다', js.includes('noteScanFile(') && js.includes('📷 사진으로 올리기') && js.includes('저장하지 않아요') && js.includes('AI'));
t('결과는 수첩 확인 표(noteRead)로 넘기고 바로 재고에 넣지 않는다', (()=>{ const s=js.slice(js.indexOf('async function noteScanFile'), js.indexOf('function noteSet(')); return s.includes('noteRead()') && !s.includes('noteSaveAll'); })());
t('서버가 켜지지 않았을 때(503)·직원 아님(403)·한도(429) 안내가 있다', ['not_configured','not_member','daily_limit'].every(k=>js.includes(k)) || (js.includes('503') && js.includes('403') && js.includes('429')));
t('사진은 올리기 전에 줄인다(긴 변 1600, JPEG)', (()=>{ const f=new Function(grab('scanTarget')+'; return scanTarget;')(); const a=f(4000,3000,1600), b=f(1000,800,1600), c=f(3000,4000,1600); return a.w===1600 && a.h===1200 && b.w===1000 && b.h===800 && c.w===1200 && c.h===1600; })());

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
