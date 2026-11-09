/* 손서명 시험 — 교육 참석 · 근로계약서 동의 · 사직서 제출이 같은 서명 칸을 쓴다.
   무엇을 보나: 선 좌표가 작게 줄어 담기는지, 다시 그려지는지, 직원별 문서(people)에 담기는지, 세 곳 모두 서명 없이는 안 넘어가는지.
   돌리는 법:  node test/서명.mjs        (설치 필요 없음) */
import fs from 'fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function grab(name){
  const i = js.indexOf('function '+name+'(');
  if(i<0) throw new Error(`index.html 에 ${name} 이 없다 — 이름이 바뀌었는지 본다`);
  let d=0;
  for(let k=js.indexOf('{', i); k<js.length; k++){
    if(js[k]==='{') d++; else if(js[k]==='}' && --d===0) return js.slice(i, k+1);
  }
  throw new Error(name+' 의 끝을 못 찾았다');
}
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const names=['signEncode','signPoints','signSvg','signOf','signPut','signDrop','pickPerson'];
const f=new Function('ctx',`let DB=ctx; let n=0; const uid=()=>'id'+(++n); const now=()=>'2026-11-09T09:00:00.000Z';
  const SIGN_W=300, SIGN_H=120; const B_PERSON=['contracts','payslips','resignations','docReqs','signs'];
  ${names.map(grab).join('\n')} return {${names.join(',')}};`);
const DB={signs:[], contracts:[], payslips:[], resignations:[], docReqs:[]};
const m=f(DB);

// 600×240 화면에 그린 선 → 300×120 으로 줄어든다
const enc=m.signEncode([[[0,0],[300,120],[600,240]],[[100,100],[100,100],[110,100]]], 600, 240);
t('좌표가 화면 크기와 무관하게 300×120 으로 줄어든다', enc==='0.0 150.60 300.120|50.50 55.50');
t('같은 점이 이어지면 한 번만 담는다', enc.split('|')[1].split(' ').length===2);
t('점 개수 세기', m.signPoints(enc)===5 && m.signPoints('')===0);
t('칸 밖으로 나간 점은 가장자리로 자른다', m.signEncode([[[-10,999]]],300,120)==='0.120');
const svg=m.signSvg(enc, 40);
t('다시 그리기: SVG 선으로 나온다', svg.startsWith('<svg') && svg.includes('d="M0 0 L150 60 L300 120 M50 50 L55 50"') && svg.includes('height="40"') && svg.includes('width="100"'));
t('이상한 값이 섞여도 터지지 않는다', m.signSvg('a.b|1.2 x', 30).includes('M1 2'));
const big=m.signEncode([Array.from({length:300},(_,i)=>[i, (i*7)%120])],300,120);
t('긴 서명도 2KB 안팎 (점 300개)', big.length<2600);

m.signPut('a','edu:r1','1.1 2.2');
m.signPut('a','edu:r1','3.3 4.4');
m.signPut('b','contract:x','5.5 6.6');
t('같은 직원·같은 자리에 다시 서명하면 바뀐다(두 개 안 쌓임)', DB.signs.filter(x=>x.staffId==='a').length===1 && m.signOf('a','edu:r1').d==='3.3 4.4');
t('다른 직원 서명과 섞이지 않는다', m.signOf('b','edu:r1')===null && m.signOf('b','contract:x').d==='5.5 6.6');
t('서명은 직원별 문서(people/{직원})에 담긴다', m.pickPerson('a').signs.length===1 && m.pickPerson('a').signs[0].key==='edu:r1' && m.pickPerson('b').signs.length===1);
m.signDrop('a','edu:r1');
t('지우기', m.signOf('a','edu:r1')===null && DB.signs.length===1);

t('공용 문서(shared)에는 서명을 안 싣는다', !/const B_SHARED = \[[^\]]*'signs'/.test(js) && /const B_PERSON = \[[^\]]*'signs'/.test(js));
t('교육 참석: 서명 없으면 안 넘어간다', /const sg=signRead\('ecSign'\); if\(!sg\)/.test(grab('doEduConfPin')) && grab('eduConfPin').includes("signPadInit('ecSign')"));
t('근로계약서: 서명 없으면 안 넘어간다', /const sg=signRead\('ctSign'\); if\(!sg\)/.test(grab('doContractAgree')) && js.includes("signPadInit('ctSign')"));
t('사직서: 서명 없으면 안 넘어간다', /const sg=signRead\('rgSign'\); if\(!sg\)/.test(grab('submitResign')) && grab('openResignForm').includes("signPadInit('rgSign')"));
t('교육 일지 인쇄에 서명이 찍힌다', grab('printEduLog').includes("signOf(sid,'edu:'+r.id)"));
t('근로계약서 인쇄에 서명이 찍힌다', js.includes("signSvg(signOf(s.id,c.signKey).d, 44)"));
t('사직서 보기에 서명이 보인다', grab('openResignView').includes('본인 서명'));
t('사직서를 철회하면 서명도 지운다', grab('cancelResign').includes('signDrop(r.staffId, r.signKey)'));
t('서명 칸은 손가락이 화면을 끌지 않게 막는다', grab('signPadHtml').includes('touch-action:none'));

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
if(fail) process.exit(1);
