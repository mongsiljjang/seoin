/* 수첩 줄 읽기 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.
   흉내낸 코드를 시험하면 앱이 고장나도 시험은 통과한다. 그래서 원본을 쓴다.

   돌리는 법:  node test/수첩읽기.mjs        (에뮬레이터·설치 필요 없음) */
import fs from 'fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

// 이름으로 함수 하나를 통째로 떼어 온다(중괄호 짝을 센다).
function grab(name){
  const i = js.indexOf('function '+name+'(');
  if(i<0) throw new Error(`index.html 에 ${name} 이 없다 — 이름이 바뀌었는지 본다`);
  let d=0;
  for(let k=js.indexOf('{', i); k<js.length; k++){
    if(js[k]==='{') d++;
    else if(js[k]==='}' && --d===0) return js.slice(i, k+1);
  }
  throw new Error(name+' 의 끝을 못 찾았다');
}
const 떼올것 = ['parseDL','findVar','caseTally','applyCaseStock','implantLog','chosung','maskName',
                'noteSpec','noteDate','noteVar','noteParse','noteFx','noteBad','noteLink','noteSaveAll',
                'esc','newFails','failNotice'];

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want);
  y?pass++:fail++; console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };

// 앱이 기대하는 바깥 것들만 최소로 채운다
// 한 줄짜리 상수도 손으로 베끼지 않는다 — 베끼면 실물과 조용히 어긋난다.
function grabConst(name){
  const m = js.match(new RegExp('^const '+name+'\\s*=.*$','m'));
  if(!m) throw new Error(`index.html 에 const ${name} 이 없다`);
  return m[0];
}

const 판 = `
const pad=n=>String(n).padStart(2,'0');
${grabConst('CHO')}
const now=()=>1; let _n=0; const uid=()=>'id'+(++_n);
const todayKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
let noteRows=[], noteText='';
const saveDB=()=>{}, closeModal=()=>{}, renderLedger=()=>{}, toast=m=>{ lastToast=m; };
let lastToast='';
// 안내 창은 실물을 돌리고 modal 만 가로챈다 — 문구까지 시험에 걸리게 하려는 것이다
let lastModal=''; const modal=h=>{ lastModal=h; };
let toastShown=true; const $=sel=>sel==='#toast'?{classList:{remove(){ toastShown=false; }}}:null;
${떼올것.map(grab).join('\n')}
`;
function 새판(){
  const DB={ implants:[{id:'p1', brand:'오스템', line:'TS III', part:'픽스처', variants:[
      {id:'v1',label:'4.0×12',qty:5,minQty:2,uNor:0,uIns:0,uFail:0},
      {id:'v2',label:'4.0×10',qty:3,minQty:2,uNor:0,uIns:0,uFail:0}]}],
    implantCases:[], implantLogs:[] };
  DB.implants[0].variants.push({id:'h1',label:'Ø4.5 GH3',qty:10,minQty:5,uNor:0,uIns:0,uFail:0});
  const f = new Function('DB', 판 +
    '; return {noteParse,noteFx,noteBad,noteLink,applyCaseStock,maskName,'
    + 'run:t=>{lastModal=\'\'; noteRows=noteParse(t); noteSaveAll(); return lastToast;}, 안내:()=>lastModal};');
  return { DB, ...f(DB) };
}

console.log('\n── 보내주신 두 줄 ──');
{
  const {noteParse,noteFx,noteBad} = 새판();
  const r = noteParse(`박소영    보험 #46 오스템 4.0*12\n          일반 #21덴티움 2.8*20`);
  ok('두 줄로 읽는다', r.length, 2);
  ok('첫 줄 환자',     r[0].name, '박소영');
  ok('첫 줄 보험',     r[0].insur, '보험');
  ok('첫 줄 치식',     r[0].teeth, ['46']);
  ok('4.0*12 를 4.0×12 로', noteFx(r[0]), '오스템 4.0×12');
  ok('첫 줄은 재고에 있다', noteBad(r[0]), '');
  // 이름이 비면 윗줄 환자를 이어받는다. '#21덴티움' 처럼 붙여 써도 갈라야 한다.
  ok('둘째 줄 환자를 이어받는다', r[1].name, '박소영');
  ok('붙여 쓴 치식을 가른다',     r[1].teeth, ['21']);
  ok('붙여 쓴 브랜드를 가른다',   r[1].brand, '덴티움');
  ok('둘째 줄 일반',              r[1].insur, '일반');
  ok('재료 목록에 없으면 알려준다', noteBad(r[1]), '재료 목록에 없는 규격이에요');
}

console.log('\n── 치식이 뒤 낱말을 먹지 않는가 ──');
{
  const {noteParse} = 새판();
  // '#46 2차수술' 의 2 를 치아로 먹으면 없는 치아가 하나 생긴다.
  ok('뒤 낱말의 숫자를 안 먹는다', noteParse('박소영 #46 2차수술')[0].teeth.join(','), '46');
  ok('쉼표로 여럿',   noteParse('박소영 #16,17 오스템 4.0×10')[0].teeth.join(','), '16,17');
  ok('# 로 여럿',     noteParse('박소영 #16#17 오스템 4.0×10')[0].teeth.join(','), '16,17');
  ok('# 를 따로 붙여도', noteParse('박소영 #16 #17 오스템 4.0×10')[0].teeth.join(','), '16,17');
}

console.log('\n── 순서가 바뀌어도 · 여러 치아 · 페일 · 날짜 ──');
{
  const {noteParse,noteFx} = 새판();
  const a = noteParse('보험 4.0*12 박소영 오스템 #46')[0];
  ok('순서를 바꿔 적어도 읽는다', [a.name,a.insur,a.teeth[0],noteFx(a)], ['박소영','보험','46','오스템 4.0×12']);
  const b = noteParse('8/21 김철수 보험 #16,17 오스템 4.0×10')[0];
  ok('치아 여러 개',  b.teeth, ['16','17']);
  ok('날짜를 읽는다', b.date, new Date().getFullYear()+'-08-21');
  const c = noteParse('이영희 #36 오스템 4.0×10 페일')[0];
  ok('페일을 읽는다', c.fail, true);
  ok('4.0 을 4 로 깎지 않는다', noteFx(c), '오스템 4.0×10');
}

console.log('\n── 저장하면 재고가 빠지는가 (진짜 applyCaseStock) ──');
{
  const {DB,noteParse,noteFx,applyCaseStock} = 새판();
  const v = DB.implants[0].variants[0];
  const rows = noteParse(`박소영 보험 #46 오스템 4.0*12\n 일반 #21덴티움 2.8*20`);
  // 화면과 같은 방식으로 묶는다 — 보험과 일반은 케이스를 나눈다
  const g=new Map();
  rows.forEach(r=>{ const k=[r.name,r.insur].join('|');
    if(!g.has(k)) g.set(k,{insur:r.insur,teeth:[]});
    r.teeth.forEach(fdi=>g.get(k).teeth.push({fdi, fx:noteFx(r), fail:!!r.fail})); });
  ok('보험과 일반은 케이스를 나눈다', g.size, 2);
  let out=0, miss=0;
  g.forEach(x=>{ const rr=applyCaseStock([], '', x.teeth, x.insur, '수첩'); out+=rr.out; miss+=rr.miss; });
  ok('재고가 5 에서 4 로', v.qty, 4);
  ok('보험 사용으로 센다', v.uIns, 1);
  ok('일반으로 세지 않는다', v.uNor, 0);
  ok('없는 규격은 안 빼고 알려준다', miss, 1);
  ok('뺀 개수', out, 1);
}

console.log('\n── 단계별 수술: 1차 → 2차 ──');
{
  const {DB,run,maskName} = 새판();
  const fx=DB.implants[0].variants[0], hl=DB.implants[0].variants[2];
  run('박소영 보험 #46 오스템 4.0*12');
  ok('1차 — 케이스가 생긴다', DB.implantCases.length, 1);
  ok('1차 — 픽스처가 빠진다', fx.qty, 4);
  ok('1차 — 이름은 초성으로', DB.implantCases[0].pname, maskName('박소영'));

  run('박소영 #46 2차수술 Ø4.5 GH3');
  ok('2차 — 케이스를 새로 만들지 않는다', DB.implantCases.length, 1);   // 여기가 핵심
  ok('2차 — 픽스처가 또 빠지지 않는다',   fx.qty, 4);
  ok('2차 — 힐링이 빠진다',               hl.qty, 9);
  ok('2차 — 힐링을 보험으로 센다',        hl.uIns, 1);
  ok('2차 — 2차수술일이 찍힌다', !!DB.implantCases[0].d2, true);
  ok('2차 — 치아에 힐링이 붙는다', DB.implantCases[0].teeth[0].heal, 'Ø4.5 GH3');
}

console.log('\n── 2차인데 1차 기록이 없으면 ──');
{
  const {DB,run} = 새판();
  const hl=DB.implants[0].variants[2];
  run('이영희 #36 2차수술 Ø4.5 GH3');
  ok('케이스를 만들지 않는다', DB.implantCases.length, 0);
  ok('힐링도 빼지 않는다',     hl.qty, 10);
}

console.log('\n── 힐링을 안 적어도 2차 날짜는 남는다 ──');
{
  const {DB,run} = 새판();
  const hl=DB.implants[0].variants[2];
  run('박소영 보험 #46 오스템 4.0*12');
  run('박소영 #46 2차수술');
  ok('2차수술일이 찍힌다',   !!DB.implantCases[0].d2, true);
  ok('힐링은 안 빠진다',     hl.qty, 10);
  ok('케이스는 그대로 하나', DB.implantCases.length, 1);
}

console.log('\n── 단계를 안 적어도 나간 물건으로 가른다 ──');
{
  const {noteParse} = 새판();
  ok('픽스처 규격이면 1차', noteParse('박소영 #46 오스템 4.0×10')[0].stage, 1);
  ok('힐링만 있으면 2차',   noteParse('박소영 #46 Ø4.5 GH3')[0].stage, 2);
  ok('2차수술이라 적으면 2차', noteParse('박소영 #46 2차수술')[0].stage, 2);
}

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
