/* 입력 빠짐 확인 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.
   돌리는 법:  node test/입력빠짐.mjs */
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
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want); y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };
const names=['vUse','vOpen','exIn','insDayN','findVar','inputGaps','gapBox'];
const make=(DB)=>new Function('DB','esc', `const GAP_COUNT_DAYS=30;\n${names.map(grab).join('\n')}\nreturn {inputGaps,gapBox};`)(DB, s=>String(s));
const V=(o)=>({id:'v', label:'4.0×12', qty:5, inTot:0, uNor:0,uIns:0,uFail:0, ...o});
const run=(variants,cases)=>{ const DB={implants:[{id:'p',brand:'오스템',variants}]}; return make(DB).inputGaps(DB.implants,cases||[], '2026-10-12').map(i=>i.code); };

ok('깨끗하면 없음', run([V({inTot:10,uNor:3,physAt:'2026-10-10'})]), []);
ok('쓴 것이 들어온 것보다 많으면 입고 확인', run([V({inTot:2,uNor:3,physAt:'2026-10-10'})]), ['inShort']);
ok('이월재고가 있으면 입고 부족 아님', run([V({opening:5,inTot:0,uNor:3,physAt:'2026-10-10'})]), []);
ok('교환입고도 들어온 것에 센다', run([V({inTot:1,exIn:2,uFail:3,physAt:'2026-10-10'})]), []);
ok('센 지 30일 넘으면 재고 확인', run([V({inTot:10,physAt:'2026-09-01'})]), ['countOld']);
ok('29일은 아직', run([V({inTot:10,physAt:'2026-09-13'})]), []);
ok('한 번도 안 셌으면 따로', run([V({inTot:10})]), ['countNone']);
ok('재고도 사용도 0이면 세라고 안 함', run([V({qty:0})]), []);
ok('재고 목록에 없는 규격', run([V({inTot:10,physAt:'2026-10-10'})],[{teeth:[{fx:'9.9×99'}]}]), ['noSpec']);
ok('있는 규격은 통과', run([V({inTot:10,physAt:'2026-10-10'})],[{teeth:[{fx:'4.0×12'}]}]), []);
ok('빈 치아 줄', run([V({inTot:10,physAt:'2026-10-10'})],[{teeth:[{fdi:'36'}]}]), ['blankTooth']);
{ const DB={implants:[]}; const f=make(DB);
  ok('없으면 안심 문구', f.gapBox([],[], '2026-10-12').includes('빠진 입력이 보이지 않아요'), true);
  const h=DB.implants.push({id:'p',brand:'오스템',variants:[V({inTot:1,uNor:3,physAt:'2026-10-10'})]})&&f.gapBox(DB.implants,[], '2026-10-12');
  ok('상자는 빨강·오차·고발 말투 없음', /danger|오차|위반|틀렸/.test(h), false); }
console.log(`\n${pass} 통과 / ${fail} 실패`); process.exit(fail?1:0);
