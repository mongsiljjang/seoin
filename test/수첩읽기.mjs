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
const 떼올것 = ['parseDL','findVar','caseTally','applyCaseStock','implantLog',
                'noteSpec','noteDate','noteVar','noteParse','noteFx','noteBad'];

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want);
  y?pass++:fail++; console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };

// 앱이 기대하는 바깥 것들만 최소로 채운다
const 판 = `
const pad=n=>String(n).padStart(2,'0');
const now=()=>1, uid=()=>'x';
${떼올것.map(grab).join('\n')}
`;
function 새판(){
  const DB={ implants:[{id:'p1', brand:'오스템', line:'TS III', part:'픽스처', variants:[
      {id:'v1',label:'4.0×12',qty:5,minQty:2,uNor:0,uIns:0,uFail:0},
      {id:'v2',label:'4.0×10',qty:3,minQty:2,uNor:0,uIns:0,uFail:0}]}],
    implantCases:[], implantLogs:[] };
  const f = new Function('DB', 판 + '; return {noteParse,noteFx,noteBad,applyCaseStock};');
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

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
