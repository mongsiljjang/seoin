/* 임플란트 대장 식립·지대주 집계 기간 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.
   돌리는 법:  node test/대장기간.mjs */
import fs from 'fs';
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
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want); y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };
const {ledgerPeriod,casesInPeriod}=new Function(`${['abCount','ledgerPeriod','casesInPeriod'].map(grab).join('\n')}\nreturn {ledgerPeriod,casesInPeriod};`)();
const C=[
  {d1:'2026-10-02', teeth:[{fdi:'46',ab:'A'},{fdi:'47'}]},
  {d1:'2026-10-30', teeth:[{fdi:'36',abT:'커스텀'}]},
  {d1:'2026-09-15', teeth:[{fdi:'11'}]},
  {d1:'2025-03-01', teeth:[{fdi:'21',ab:'B'}]},
  {d1:'',           teeth:[{fdi:'31'}]},          // 수술일 없는 케이스는 어느 기간에도 안 센다
];
const T='2026-10-12';
let r=ledgerPeriod(C,'month','',  '','',T);
ok('기본은 이번 달', [r.label,r.n,r.t,r.a], ['이번 달',2,3,2]);
r=ledgerPeriod(C,'month','2026-09','','',T);
ok('지난달', [r.label,r.n,r.t,r.a], ['9월',1,1,0]);
r=ledgerPeriod(C,'month','2025-03','','',T);
ok('작년 달은 연도를 붙인다', [r.label,r.n,r.t,r.a], ['2025년 3월',1,1,1]);
r=ledgerPeriod(C,'range','','2026-09-01','2026-10-02',T);
ok('기간 지정(양끝 포함)', [r.label,r.n,r.t], ['선택 기간',2,3]);
r=ledgerPeriod(C,'range','','2026-10-01','',T);
ok('끝 날짜를 비우면 그 뒤 전부', [r.n], [2]);
r=ledgerPeriod(C,'all','','','',T);
ok('전체(수술일 없는 것 제외)', [r.label,r.n,r.t], ['전체',4,5]);
r=ledgerPeriod([], 'month','','','',T);
ok('비어 있으면 0', [r.n,r.t,r.a], [0,0,0]);
{
  const L=[...C, {d0:'2026-10-05', d1:'', teeth:[{fdi:'41'}]}, {d1:'2026-09-20', d3:'2026-10-08', teeth:[{fdi:'12'}]}];
  const lst=(mode,ym,f,t)=>casesInPeriod(L, ledgerPeriod(L,mode,ym,f,t,T)).length;
  ok('목록: 이번 달 — 1차 10월 2건 + 진단만 10월 + 보철만 10월', lst('month','','',''), 4);
  ok('목록: 지난달', lst('month','2026-09','',''), 2);
  ok('목록: 전체는 걸러내지 않는다', lst('all','','',''), L.length);
  ok('목록: 기간 지정', lst('range','','2026-10-01','2026-10-03'), 1);
}
console.log(`\n${pass} 통과 / ${fail} 실패`); process.exit(fail?1:0);
