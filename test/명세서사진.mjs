/* 거래명세서 사진·붙여넣기 시험 — 서버 함수의 bill 모드와 앱 쪽 연결을 실제 AI 를 부르지 않고 돌려 본다.
   돌리는 법:  node test/명세서사진.mjs        (설치 필요 없음) */
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const scan = require('../api/scan.js');
const core = require('../api/_core.js');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
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
const NL = String.fromCharCode(10);

console.log('── 서버: parseBill ──');
const rows = core.parseBill([
  '| 품목명 | 규격 | 수량 |', '|---|---|---|',
  '오스템 TS III | 4.0*10 | 5개 | 120,000원 | 오스템임플란트 | 2026-10-12 | A12345',
  '**메가젠 Anyridge** | 3.5*8 | 2 | | | |',
  '합계 | | 7 | 1',
  '잡담 한 줄', '010-1234-5678 | x | 1'
].join(NL));
t('머리줄이 맨 앞에 붙는다', rows[0].join(',')==='품목명,규격,수량,단가,거래처,일자,LOT');
t('품목 줄 두 개 + 전화번호 줄(칸에서 번호만 지움)', rows.length===4);
t('규격의 * 는 살아 있다', rows[1][1]==='4.0*10');
t('수량·단가는 숫자만', rows[1][2]==='5' && rows[1][3]==='120000');
t('굵은 글씨 표시(**)는 벗긴다', rows[2][0]==='메가젠 Anyridge');
t('합계 줄·표 구분선·머리줄은 버린다', !rows.some(r=>/합계/.test(r[0]) || /^-+$/.test(r[0]) || r[0]==='품목명' && r!==rows[0]));
t('전화번호는 지운다', !rows.some(r=>r.join(' ').includes('1234-5678')));
t('읽은 줄이 하나도 없으면 빈 배열', core.parseBill('아무 말이나'+NL+'| |').length===0);

console.log('── 서버: handle(mode bill) ──');
const tokenFor = uid => 'x.' + Buffer.from(JSON.stringify({user_id:uid})).toString('base64') + '.y';
const IMG = 'data:image/jpeg;base64,' + 'A'.repeat(200);
const sent = [];
const fakeFetch = async (url, opt) => {
  if(String(url).includes('firestore.googleapis.com')) return {status:200, ok:true};
  sent.push(JSON.parse(opt.body));
  return {ok:true, status:200, json:async()=>({content:[{type:'text', text:'오스템 TS III | 4.0*10 | 5 | 120000 | 오스템 | 2026-10-12 | A1'}]})};
};
const saved = globalThis.fetch; globalThis.fetch = fakeFetch;
let r; try { r = await core.handle({method:'POST', body:{image:IMG, ws:'hosp1', idToken:tokenFor('b1'), mode:'bill'}, env:{ANTHROPIC_API_KEY:'k'}}); }
finally { globalThis.fetch = saved; }
t('bill 모드는 rows 를 돌려주고 수첩 줄(lines)은 안 돌려준다', r.status===200 && Array.isArray(r.json.rows) && r.json.lines===undefined);
t('명세서용 프롬프트를 쓴다', sent[0] && sent[0].system===core.BILL_PROMPT && sent[0].system!==core.SYSTEM_PROMPT);
t('rows 첫 줄이 머리줄, 둘째 줄이 품목', r.json.rows[0][0]==='품목명' && r.json.rows[1][1]==='4.0*10');
t('사진 모양이 아니면 거절', (await core.handle({method:'POST', body:{image:'zzz', ws:'hosp1', idToken:'x', mode:'bill'}, env:{ANTHROPIC_API_KEY:'k'}})).status===400);

console.log('── 앱: 연결 ──');
t('명세서 화면에 사진 버튼과 글 붙여넣기가 있다', (()=>{ const s=js.slice(js.indexOf('function openPurchase'), js.indexOf('function handlePurchase')); return s.includes('billScanFile') && s.includes('billPaste()') && s.includes('id="billText"'); })());
t("사진은 같은 호출(scanCall('bill'))을 쓴다", js.includes("scanCall('bill', file)"));
t('읽은 결과는 바로 넣지 않고 확인 화면(previewPurchase)으로 간다', (()=>{ const s=js.slice(js.indexOf('async function billScanFile')); const e=s.indexOf('finally'); const body=s.slice(0,e); return body.includes('previewPurchase(lines)') && !body.includes('applyPurchase'); })());
t('명세서 화면의 예전 "사진을 Claude 대화창에 보내주세요" 안내는 없다', !html.includes('종이 명세서는 <b>사진을 찍어 Claude'));

console.log('── 앱: 글로 붙여넣기 읽기(billPaste) ──');
{
  let preview=null, toastMsg='';
  const make = (text) => new Function('purchaseRows','previewPurchase','toast','$', 'return ('+grab('billPaste')+')')
  ;
  const fns = ['purchaseRows','pKind','splitFixture'].map(grab).join(NL);
  const PCOL = js.match(/^const PCOL=\{[\s\S]*?^\};/m)[0];
  const run = (text) => { preview=null; toastMsg='';
    const f = new Function('previewPurchase','toast','$', PCOL+NL+fns+NL+grab('billPaste')+NL+'return billPaste;')(l=>{preview=l;}, m=>{toastMsg=m;}, ()=>({value:text}));
    f(); return preview; };
  let p = run('품목명, 규격, 수량, 단가'+NL+'오스템 TS III, 4.0*10, 5, 120000');
  t('쉼표로 나눈 글을 읽는다', p && p.length===1 && p[0].qty===5 && p[0].price===120000);
  p = run('규격\t품목명\t수량'+NL+'4.0*10\t오스템 TS III\t3');
  t('탭(엑셀 복사)이고 열 순서가 달라도 제목으로 찾는다', p && p[0].qty===3);
  p = run('품목명, 수량'+NL+'합계, 9');
  t('합계 줄만 있으면 읽을 것이 없다고 알린다', p===null && toastMsg.includes('읽을 수 있는 품목이 없어요'));
}
console.log(NL+pass+' 통과 / '+fail+' 실패'); process.exit(fail?1:0);
