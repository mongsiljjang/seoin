/* 세무사에 보낼 월 자료 시험 — index.html 에서 함수를 이름으로 떼어 와 돌린다.

   무엇을 보나: 직원별 근무일·시간·연장·야간·휴일·연월차가 맞게 모이는지, 다른 달·대기 중인 연차가 섞이지 않는지,
   원장(사업주)은 빠지는지, 그 달에 퇴사한 사람은 들어가고 지난달에 나간 사람은 빠지는지, 금액 열이 없는지.
   돌리는 법:  node test/세무사자료.mjs        (설치 필요 없음) */
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
const names=['restDayIdx','isWeeklyRest','hospHolidays','holidayNameOf','isRestDay','hoursBetween','nightHours','dailyHoursOf','dayWork','isEmployer','payBasisRows'];
const m = new Function('ctx', `let DB=ctx; ${names.map(grab).join('\n')} return {${names.join(',')}};`);
const L=(mo,d,h,mi)=>new Date(2026,mo-1,d,h,mi).toISOString();

const DB={
  hosp:{restDayIdx:0, holidays:[]},
  staff:[
    {id:'o', name:'원장', employment:'owner', active:true},
    {id:'a', name:'김위생', dept:'진료', joinDate:'2024-03-02', monthlyHours:209, active:true},
    {id:'b', name:'이조무', dept:'진료', active:false, retiredAt:'2026-11-20'},
    {id:'c', name:'박퇴사', active:false, retiredAt:'2026-10-15'},
  ],
  attendance:[
    {staffId:'a', date:'2026-11-02', inAt:L(11,2,9,0), outAt:L(11,2,19,0)},     // 10시간 → 연장 2
    {staffId:'a', date:'2026-11-03', inAt:L(11,3,9,0), outAt:L(11,3,18,0)},     // 9시간 → 연장 1
    {staffId:'a', date:'2026-11-08', inAt:L(11,8,10,0), outAt:L(11,8,14,0)},    // 일요일 4시간 → 휴일
    {staffId:'a', date:'2026-11-04', inAt:L(11,4,14,0), outAt:L(11,4,23,0)},    // 9시간, 야간 1
    {staffId:'a', date:'2026-10-30', inAt:L(10,30,9,0), outAt:L(10,30,18,0)},   // 다른 달
    {staffId:'o', date:'2026-11-02', inAt:L(11,2,9,0), outAt:L(11,2,18,0)},
  ],
  leaves:[
    {staffId:'a', type:'annual', status:'approved', startDate:'2026-11-10', endDate:'2026-11-11', days:2},
    {staffId:'a', type:'half', status:'approved', startDate:'2026-11-12', endDate:'2026-11-12', days:0.5},
    {staffId:'a', type:'hours', status:'approved', startDate:'2026-11-13', endDate:'2026-11-13', days:0.25, hours:2},
    {staffId:'a', type:'sick', status:'pending', startDate:'2026-11-14', endDate:'2026-11-14', days:1},
    {staffId:'a', type:'annual', status:'approved', startDate:'2026-10-05', endDate:'2026-10-05', days:1},
  ]};
const f=m(DB);
const rows=f.payBasisRows('2026-11'), head=rows[0], body=rows.slice(1);
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const col=(r,name)=>r[head.indexOf(name)];
const A=body.find(r=>r[0]==='김위생');

t('원장(사업주)은 빠진다', !body.some(r=>r[0]==='원장'));
t('그 달에 퇴사한 사람은 들어간다', body.some(r=>r[0]==='이조무' && col(r,'퇴사일')==='2026-11-20'));
t('지난달 퇴사자는 빠진다', !body.some(r=>r[0]==='박퇴사'));
t('근무일 4 (다른 달 제외)', col(A,'근무일')===4);
t('총 근무시간 32', col(A,'총 근무시간')===32);
t('연장 4 (2+1+1, 휴일 제외)', col(A,'연장')===4);
t('야간 1 (22~23시)', col(A,'야간')===1);
t('휴일 근무 4 (일요일)', col(A,'휴일 근무')===4);
t('계약 월 시간', col(A,'계약 월 시간')===209);
t('연차 2일 (지난달 1일 제외)', col(A,'연차(일)')===2);
t('반차 0.5일', col(A,'반차(일)')===0.5);
t('시간연차 2시간', col(A,'시간연차(시간)')===2);
t('대기 중인 병가는 안 센다', col(A,'병가(일)')===0);
t('입사일', col(A,'입사일')==='2024-03-02');
t('금액(급여·세금) 열은 없다', !head.some(h=>/급여|세|보험|원\)|금액/.test(h)));
t('세무사 자료 버튼이 출퇴근 화면에 있다', /onclick="exportPayBasis\(\)"/.test(html));

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
if(fail) process.exit(1);
