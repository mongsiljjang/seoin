/* 단계별 수술 재고 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.

   1차수술은 픽스처, 2차수술은 힐링, 보철은 지대주를 뱉는다. 단계마다 다른
   물건이 나가므로, 같은 케이스를 갱신할 때 앞 단계 것이 또 빠지면 안 된다.
   힐링은 빌려주는 물건이라 돌아오면 재고로 되돌린다.

   돌리는 법:  node test/단계별수술.mjs */
import fs from 'fs';

const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
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
const 판 = `const now=()=>1, uid=()=>'x';
${['parseDL','findVar','caseTally','applyCaseStock','implantLog','healOut','recallStock'].map(grab).join('\n')}`;

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=got===want; y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${want} 여야 하는데 ${got}`}`); };

function 새판(){
  const DB={ implants:[
    {id:'p1',brand:'오스템',part:'픽스처', variants:[{id:'v1',label:'4.0×10',qty:5,uNor:0,uIns:0,uFail:0}]},
    {id:'p2',brand:'오스템',part:'힐링캡', variants:[{id:'h1',label:'Ø4.5 GH3',qty:10,uNor:0,uIns:0,uFail:0}]},
    {id:'p3',brand:'오스템',part:'어버트먼트',variants:[{id:'a1',label:'Ø4.5 기성',qty:8,uNor:0,uIns:0,uFail:0}]}],
    implantLogs:[] };
  const f=new Function('DB', 판+'; return {applyCaseStock, recallStock};');
  return { DB, fx:DB.implants[0].variants[0], hl:DB.implants[1].variants[0],
           ab:DB.implants[2].variants[0], ...f(DB) };
}

console.log('\n── 보험 케이스: 1차 → 2차 → 보철 ──');
{
  const {fx,hl,ab,applyCaseStock} = 새판();
  const FX='오스템 4.0×10', HL='Ø4.5 GH3', AB='Ø4.5 기성';

  let teeth=[{fdi:'46', fx:FX}];
  applyCaseStock([], '', teeth, '보험', '1차');
  ok('1차 — 픽스처가 빠진다',      fx.qty, 4);
  ok('1차 — 보험 사용으로 센다',   fx.uIns, 1);
  ok('1차 — 힐링은 그대로',        hl.qty, 10);

  let prev=teeth;
  teeth=[{fdi:'46', fx:FX, heal:HL}];
  const r2=applyCaseStock(prev, '보험', teeth, '보험', '2차');
  ok('2차 — 힐링만 빠진다',        hl.qty, 9);
  ok('2차 — 이번에 뺀 것은 1개',   r2.out, 1);
  ok('2차 — 픽스처는 또 안 빠진다', fx.qty, 4);   // 여기가 핵심이다
  ok('2차 — 픽스처 사용수도 그대로', fx.uIns, 1);

  prev=teeth;
  teeth=[{fdi:'46', fx:FX, heal:HL, ab:AB}];
  const r3=applyCaseStock(prev, '보험', teeth, '보험', '보철');
  ok('보철 — 지대주만 빠진다',     ab.qty, 7);
  ok('보철 — 이번에 뺀 것은 1개',  r3.out, 1);
  ok('보철 — 픽스처·힐링 그대로',  fx.qty+hl.qty, 4+9);
}

console.log('\n── 힐링 회수: 나갈 때 센 칸으로 되돌아오는가 ──');
{
  const {hl,applyCaseStock,recallStock} = 새판();
  const HL='Ø4.5 GH3';
  const c={chart:'A-1', insur:'보험', teeth:[{fdi:'46', heal:HL}]};
  applyCaseStock([], '', c.teeth, '보험', '2차');
  ok('나갈 때 보험으로 센다', hl.uIns, 1);
  ok('나갈 때 재고가 준다',   hl.qty, 9);

  recallStock(c, 1);
  ok('회수하면 재고가 돌아온다',        hl.qty, 10);
  ok('보험 사용수에서 되돌린다',        hl.uIns, 0);   // 전에는 1 로 남았다
  ok('일반 사용수를 건드리지 않는다',   hl.uNor, 0);   // 전에는 여기서 뺐다
}

console.log('\n── 일반 케이스도 그대로인가 (되돌아가지 않았는지) ──');
{
  const {hl,applyCaseStock,recallStock} = 새판();
  const HL='Ø4.5 GH3';
  const c={chart:'A-2', insur:'일반', teeth:[{fdi:'36', heal:HL}]};
  applyCaseStock([], '', c.teeth, '일반', '2차');
  ok('일반으로 센다', hl.uNor, 1);
  recallStock(c, 1);
  ok('일반에서 되돌린다', hl.uNor, 0);
  ok('재고가 돌아온다',   hl.qty, 10);
}

console.log('\n── 일부만 돌아온 경우 (분실) ──');
{
  const {hl,applyCaseStock,recallStock} = 새판();
  const HL='Ø4.5 GH3';
  const c={chart:'A-3', insur:'보험', teeth:[{fdi:'46',heal:HL},{fdi:'47',heal:HL}]};
  applyCaseStock([], '', c.teeth, '보험', '2차');
  ok('둘 다 나갔다', hl.qty, 8);
  const done=recallStock(c, 1);
  ok('하나만 되돌린다',       hl.qty, 9);
  ok('되돌린 개수를 알려준다', done, 1);
  ok('사용수도 하나만 되돌린다', hl.uIns, 1);
}

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
