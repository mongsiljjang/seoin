/* 직원 한 명의 한 달 · 출퇴근 시간 고치기 시험 — index.html 에서 함수를 이름으로 떼어 와 돌린다.

   무엇을 보나: 한 달 칸이 날짜 수만큼 나오는지, 출퇴근·근무시간·승인된 연차·휴일이 그 날에 붙는지,
   대기 중인 연차는 안 붙는지, 다른 직원 기록이 섞이지 않는지, 시간 고치기가 틀린 입력을 막는지.
   돌리는 법:  node test/직원한달.mjs        (설치 필요 없음) */
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
const names=['pad','restDayIdx','isWeeklyRest','hospHolidays','holidayNameOf','restDayLabel','hoursBetween',
  'attMonthCells','attMonthSum','mkShift','attIso','attHm','attEditPlan'];
const m = new Function('ctx', `
  const WEEK_KO=['일','월','화','수','목','금','토'];
  const LEAVE_KO={annual:'연차',monthly:'월차',half:'반차',hours:'시간연차',sick:'병가',etc:'기타'};
  let DB=ctx;
  ${names.map(grab).join('\n')}
  return {${names.join(',')}};`);

let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const L=(d,h,mi)=>new Date(2026,10,d,h,mi).toISOString();   // 2026-11-d 현지 시각

const DB={
  hosp:{restDayIdx:0, holidays:[{date:'2026-11-20',name:'병원 휴무'}]},
  attendance:[
    {staffId:'a', date:'2026-11-02', inAt:L(2,9,0), outAt:L(2,18,30)},
    {staffId:'a', date:'2026-11-03', inAt:L(3,9,5), outAt:null},
    {staffId:'b', date:'2026-11-02', inAt:L(2,8,0), outAt:L(2,20,0)},
    {staffId:'a', date:'2026-11-08', inAt:L(8,10,0), outAt:L(8,14,0), edits:[{}]},
  ],
  leaves:[
    {staffId:'a', type:'annual', status:'approved', startDate:'2026-11-10', endDate:'2026-11-11'},
    {staffId:'a', type:'half', status:'pending', startDate:'2026-11-12', endDate:'2026-11-12'},
    {staffId:'b', type:'sick', status:'approved', startDate:'2026-11-13', endDate:'2026-11-13'},
  ]};
const f=m(DB);
const cells=f.attMonthCells('a','2026-11');
const at=d=>cells[d-1];
t('11월은 30칸', cells.length===30);
t('2월(윤년 아님)은 28칸', f.attMonthCells('a','2026-02').length===28);
t('11/2: 9:00~18:30 = 9시간 30분', Math.abs(at(2).hours-9.5)<1e-9);
t('11/3: 퇴근 전은 0시간, 출근은 남는다', at(3).hours===0 && !!at(3).inAt && !at(3).outAt);
t('다른 직원(b) 기록이 안 섞인다', !at(13).leave && cells.filter(c=>c.inAt).length===3);
t('승인된 연차가 그 기간에 붙는다', at(10).leave==='연차' && at(11).leave==='연차');
t('대기 중인 반차는 안 붙는다', at(12).leave==='');
t('주휴일(일요일) 표시', at(1).rest==='일요일' && at(8).rest==='일요일');
t('병원 휴무일 표시', at(20).rest==='병원 휴무');
t('요일 계산 (11/2 = 월)', at(2).dow===1);
t('고친 날 표시값', at(8).edited===true && at(2).edited===false);
const s=f.attMonthSum(cells);
t('합계: 근무일 3 · 시간 13.5 · 연차 쓴 날 2', s.days===3 && Math.abs(s.hours-13.5)<1e-9 && s.leaveDays===2);
t('달 넘기기', f.mkShift('2026-11',1)==='2026-12' && f.mkShift('2026-01',-1)==='2025-12' && f.mkShift('2026-12',1)==='2027-01');

const p=f.attEditPlan('2026-11-03','09:05','18:00');
t('시간 고치기: 정상', p.ok && f.attHm(p.inAt)==='09:05' && f.attHm(p.outAt)==='18:00');
t('퇴근 비워두면 출근만', (()=>{ const q=f.attEditPlan('2026-11-03','09:05',''); return q.ok && q.outAt===null; })());
t('출근 없으면 막는다', !f.attEditPlan('2026-11-03','','18:00').ok);
t('퇴근이 출근보다 이르면 막는다', !f.attEditPlan('2026-11-03','18:00','09:00').ok);
t('같은 시각이면 막는다', !f.attEditPlan('2026-11-03','09:00','09:00').ok);
t('이상한 형식은 막는다', !f.attEditPlan('2026-11-03','9시','18:00').ok);
t('고친 시각은 그 날짜에 붙는다', new Date(p.inAt).getDate()===3);

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
if(fail) process.exit(1);
