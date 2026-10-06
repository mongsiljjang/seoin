/* 보험 페일 → 시술중지 안내 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.

   근거는 docs/INSURANCE_RULES.md 3장. 앱이 보험 규정에 대해 하는 일은 이것
   하나뿐이라, 이 하나가 정확해야 한다. 두 가지를 본다.

     ① 새로 생긴 페일만 알린다 — 고칠 때마다 뜨면 양치기가 되어 무시된다
     ② 2차 수술 때 드러난 페일도 기록된다 — 골유착 실패가 여기서 나온다

   돌리는 법:  node test/보험페일.mjs        (에뮬레이터·설치 필요 없음) */
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
function grabConst(name){
  const m = js.match(new RegExp('^const '+name+'\\s*=.*$','m'));
  if(!m) throw new Error(`index.html 에 const ${name} 이 없다`);
  return m[0];
}

const 떼올것 = ['parseDL','findVar','caseTally','applyCaseStock','implantLog','chosung','maskName',
                'noteSpec','noteDate','noteVar','noteParse','noteFx','noteBad','noteLink','noteSaveAll',
                'esc','newFails','failNotice'];

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want);
  y?pass++:fail++; console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };

const 판 = `
const pad=n=>String(n).padStart(2,'0');
${grabConst('CHO')}
const now=()=>1; let _n=0; const uid=()=>'id'+(++_n);
const todayKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
let noteRows=[], noteText='';
const saveDB=()=>{}, closeModal=()=>{}, renderLedger=()=>{}, toast=m=>{ lastToast=m; };
let lastToast='';
let lastModal=''; const modal=h=>{ lastModal=h; };
let toastShown=true; const $=sel=>sel==='#toast'?{classList:{remove(){ toastShown=false; }}}:null;
${떼올것.map(grab).join('\n')}
`;
function 새판(){
  const DB={ implants:[{id:'p1', brand:'오스템', line:'TS III', part:'픽스처', variants:[
      {id:'v1',label:'4.0×12',qty:5,minQty:2,uNor:0,uIns:0,uFail:0},
      {id:'h1',label:'Ø4.5 GH3',qty:10,minQty:5,uNor:0,uIns:0,uFail:0}]}],
    implantCases:[], implantLogs:[] };
  const f = new Function('DB', 판 +
    '; return {newFails, failNotice, 안내:()=>lastModal, 토스트:()=>toastShown,'
    + 'run:t=>{lastModal=\'\'; noteRows=noteParse(t); noteSaveAll(); return lastToast;}};');
  return { DB, fx:DB.implants[0].variants[0], hl:DB.implants[0].variants[1], ...f(DB) };
}

console.log('\n── 새로 생긴 페일만 센다 ──');
{
  const {newFails} = 새판();
  const 성함=[{fdi:'46'},{fdi:'47'}];
  ok('일반 케이스는 알리지 않는다',
     newFails([], '', [{fdi:'46',fail:true}], '일반'), []);
  ok('보험인데 페일이 없으면 조용하다',
     newFails([], '', 성함, '보험'), []);
  ok('보험에 페일이 새로 적히면 알린다',
     newFails([], '', [{fdi:'46',fail:true}], '보험'), ['46']);
  ok('이미 알린 페일은 다시 알리지 않는다',
     newFails([{fdi:'46',fail:true}], '보험', [{fdi:'46',fail:true}], '보험'), []);
  ok('둘 중 새로 생긴 하나만 알린다',
     newFails([{fdi:'46',fail:true}], '보험',
              [{fdi:'46',fail:true},{fdi:'47',fail:true}], '보험'), ['47']);
  ok('일반이던 것을 보험으로 바꾸면 옛 페일도 처음 알리는 것이다',
     newFails([{fdi:'46',fail:true}], '일반', [{fdi:'46',fail:true}], '보험'), ['46']);
  ok('보험을 일반으로 바꾸면 알리지 않는다',
     newFails([{fdi:'46',fail:true}], '보험', [{fdi:'46',fail:true}], '일반'), []);
  ok('치식이 숫자든 문자든 같은 치아로 본다',
     newFails([{fdi:46,fail:true}], '보험', [{fdi:'46',fail:true}], '보험'), []);
  ok('페일을 지우면 알릴 것이 없다',
     newFails([{fdi:'46',fail:true}], '보험', [{fdi:'46'}], '보험'), []);
}

console.log('\n── 안내 문구 — 판정이 아니라 물음이다 ──');
{
  const {failNotice, 안내} = 새판();
  failNotice([], '1234');
  ok('알릴 페일이 없으면 창을 띄우지 않는다', 안내(), '');
  failNotice(['46','47'], '1234');
  const h=안내();
  ok('물음으로 묻는다',            h.includes('시술중지 등록하셨나요?'), true);
  ok('되돌릴 수 없는 시점을 알린다', h.includes('중지 등록이 안 됩니다'), true);
  ok('어느 치아인지 보여준다',      h.includes('#46 #47'), true);
  ok('차트번호를 보여준다',         h.includes('1234'), true);
  ok('수가·금액은 말하지 않는다',   /원|수가|점수|본인부담/.test(h), false);
  ok('개수·연령을 판정하지 않는다', /65세|평생|2개까지/.test(h), false);
}
{
  const {failNotice, 안내, 토스트} = 새판();
  failNotice(['46'], '1234', '1건 새로 적음 · 재고 1개 차감');
  ok('저장 요약을 안내 안으로 들인다', 안내().includes('1건 새로 적음'), true);
  ok('겹치는 토스트를 걷어낸다', 토스트(), false);
}

console.log('\n── 수첩: 1차 수술 줄 ──');
{
  const {run, 안내, DB} = 새판();
  run('08-19 홍길동 #46 보험 오스템 4.0×12 페일');
  ok('보험 페일이면 안내가 뜬다', 안내().includes('시술중지 등록하셨나요?'), true);
  ok('케이스에 페일이 남는다', !!DB.implantCases[0].teeth[0].fail, true);
}
{
  const {run, 안내} = 새판();
  run('08-19 홍길동 #46 오스템 4.0×12 페일');
  ok('일반 페일에는 안내가 뜨지 않는다', 안내(), '');
}
{
  const {run, 안내} = 새판();
  run('08-19 홍길동 #46 보험 오스템 4.0×12');
  ok('페일이 없으면 안내가 뜨지 않는다', 안내(), '');
}

console.log('\n── 수첩: 2차 수술에서 드러난 페일 ──');
{
  const {run, 안내, DB, fx} = 새판();
  run('08-19 홍길동 #46 보험 오스템 4.0×12');
  ok('1차에서는 조용하다', 안내(), '');
  ok('1차 — 보험 사용으로 센다', [fx.qty, fx.uIns, fx.uFail], [4, 1, 0]);

  run('08-25 홍길동 #46 2차수술 페일');
  ok('2차수술 페일이 케이스에 기록된다', !!DB.implantCases[0].teeth[0].fail, true);
  ok('2차에서 드러난 페일도 안내한다', 안내().includes('시술중지 등록하셨나요?'), true);
  ok('사용 구분이 보험에서 페일로 옮겨간다', [fx.qty, fx.uIns, fx.uFail], [4, 0, 1]);
}
{
  const {run, 안내, DB} = 새판();
  run('08-19 홍길동 #46 오스템 4.0×12');
  run('08-25 홍길동 #46 2차수술 페일');
  ok('일반 케이스의 2차 페일도 기록은 된다', !!DB.implantCases[0].teeth[0].fail, true);
  ok('다만 일반이라 안내는 없다', 안내(), '');
}
{
  const {run, 안내, DB} = 새판();
  run('08-19 홍길동 #46 보험 오스템 4.0×12 페일');
  run('08-25 홍길동 #46 2차수술');
  ok('1차에서 이미 알린 페일을 2차에서 또 알리지 않는다', 안내(), '');
  ok('페일은 그대로 남아 있다', !!DB.implantCases[0].teeth[0].fail, true);
}

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
process.exit(fail?1:0);
