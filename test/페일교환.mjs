/* 페일 교환 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.

   지켜야 할 것은 셋이다. 사용자가 못 박은 그대로다.

     ① 세는 함수는 재고를 건드리지 않는다
     ② 교환 신청은 재고를 바꾸지 않는다
     ③ 재고는 물건이 실제로 들어올 때만 는다 — 신청 없이는 받을 수 없다

   그리고 교환으로 받은 것은 매입에 섞지 않는다. 섞으면 산 개수가 부풀고
   원가가 흐려지는데 재고 개수는 맞아떨어져서 눈에 안 띈다.

   돌리는 법:  node test/페일교환.mjs        (설치 필요 없음) */
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
const 떼올것 = ['parseDL','findVar','caseTally','applyCaseStock','implantLog','vUse','vDiff',
                'exReq','exIn','failOpen','failWait','vOpen','vAdj','vBook','pFailOpen','pFailWait','pExIn',
                'claimFail','receiveFail'];

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want); y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };

function 새판(){
  const DB={ implants:[{id:'p1', brand:'오스템', part:'픽스처', variants:[
      {id:'v1', label:'4.0×12', qty:10, minQty:2, inTot:10, uNor:0,uIns:0,uFail:0, phys:null},
      {id:'v2', label:'4.0×10', qty:5,  minQty:2, inTot:5,  uNor:0,uIns:0,uFail:0, phys:null}]}],
    implantCases:[], implantLogs:[] };
  const f=new Function('DB', `const now=()=>1, uid=()=>'x';
const implantById=id=>DB.implants.find(p=>p.id===id);
const todayKey=()=>'2026-08-21', tms=d=>Date.parse(d+'T00:00:00Z'), DAY_MS=86400000;
const healOut=c=>(c.teeth||[]).filter(t=>String(t.heal||'').trim()).length;
const isOut=c=>!!c.d2 && !c.recallAt && healOut(c)>0;
const healDue=c=>c.d2? tms(c.d2)+14*DAY_MS : null;
const healLate=c=>{ const d=healDue(c); return d? Math.floor((tms('2026-09-30')-d)/DAY_MS):0; };
const outCases=()=>(DB.implantCases||[]).filter(isOut);
${떼올것.map(grab).join('\n')}
return {claimFail,receiveFail,failOpen,failWait,vOpen,vAdj,vBook,vUse,pFailOpen,pFailWait,pExIn,applyCaseStock};`)(DB);
  return { DB, p:DB.implants[0], v:DB.implants[0].variants[0], ...f };
}
// 이월 + 매입 + 교환입고 + 보정 − 사용 = 현재고
const 장부맞나 = v => (+v.opening||0) + (+v.inTot||0) + (+v.exIn||0) + (+v.adj||0) - ((+v.uNor||0)+(+v.uIns||0)+(+v.uFail||0)) === v.qty;

console.log('\n── 페일이 나면 재고는 이미 빠져 있다 ──');
{
  const {v, applyCaseStock, failOpen} = 새판();
  applyCaseStock([], '', [{fdi:'46', fx:'오스템 4.0×12', fail:true}], '보험', 'a');
  ok('재고가 하나 빠졌다',        v.qty, 9);
  ok('페일로 셌다',              v.uFail, 1);
  ok('교환 신청 대상이 하나 생겼다', failOpen(v), 1);
  ok('장부 식이 맞는다',          장부맞나(v), true);
}

console.log('\n── 교환 신청은 재고를 건드리지 않는다 ──');
{
  const {v, applyCaseStock, claimFail, failOpen, failWait} = 새판();
  applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12',fail:true},{fdi:'47',fx:'오스템 4.0×12',fail:true}], '일반', 'a');
  const 전 = v.qty;
  ok('신청한 개수를 돌려준다',   claimFail('p1','v1',2), 2);
  ok('재고는 그대로다',          v.qty, 전);
  ok('신청 안 한 페일이 없어졌다', failOpen(v), 0);
  ok('신청했는데 안 온 것이 둘',  failWait(v), 2);
  ok('매입은 안 늘었다',         v.inTot, 10);
  ok('장부 식이 맞는다',         장부맞나(v), true);
}
{
  const {v, applyCaseStock, claimFail, failOpen} = 새판();
  applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12',fail:true}], '일반', 'a');
  ok('페일난 개수보다 많이 신청할 수 없다', claimFail('p1','v1',5), 1);
  ok('신청 안 한 페일은 0 이 된다',       failOpen(v), 0);
  ok('더 신청해도 0 이다',                claimFail('p1','v1',3), 0);
}

console.log('\n── 재고는 입고 확인 때만 는다 ──');
{
  const {v, applyCaseStock, claimFail, receiveFail, failWait} = 새판();
  applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12',fail:true}], '일반', 'a');
  ok('신청 없이는 받을 수 없다', receiveFail('p1','v1',1), 0);
  ok('그래서 재고도 그대로다',   v.qty, 9);

  claimFail('p1','v1',1);
  ok('신청한 뒤에는 받을 수 있다', receiveFail('p1','v1',1), 1);
  ok('그때 재고가 는다',          v.qty, 10);
  ok('기다리는 것이 없어졌다',    failWait(v), 0);
  ok('매입에는 안 섞인다',        v.inTot, 10);
  ok('교환입고로 따로 센다',      v.exIn, 1);
  ok('장부 식이 맞는다',          장부맞나(v), true);
}
{
  const {v, applyCaseStock, claimFail, receiveFail} = 새판();
  applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12',fail:true},{fdi:'47',fx:'오스템 4.0×12',fail:true}], '일반', 'a');
  claimFail('p1','v1',2);
  ok('신청한 것보다 많이 받을 수 없다', receiveFail('p1','v1',9), 2);
  ok('재고는 신청한 만큼만 늘었다',    v.qty, 10);
  ok('장부 식이 맞는다',               장부맞나(v), true);
}
{
  const {v, applyCaseStock, claimFail, receiveFail, failWait} = 새판();
  applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12',fail:true},{fdi:'47',fx:'오스템 4.0×12',fail:true}], '일반', 'a');
  claimFail('p1','v1',2); receiveFail('p1','v1',1);
  ok('나눠 받을 수 있다',        [v.qty, v.exIn, failWait(v)], [9, 1, 1]);
  receiveFail('p1','v1',1);
  ok('나머지도 받는다',          [v.qty, v.exIn, failWait(v)], [10, 2, 0]);
  ok('장부 식이 맞는다',         장부맞나(v), true);
}

console.log('\n── 없는 규격·엉뚱한 값 ──');
{
  const {v, claimFail, receiveFail} = 새판();
  ok('없는 제품이면 0',      claimFail('없음','v1',1), 0);
  ok('없는 규격이면 0',      claimFail('p1','없음',1), 0);
  ok('음수는 0',             claimFail('p1','v1',-3), 0);
  ok('숫자가 아니면 0',      receiveFail('p1','v1','abc'), 0);
  ok('아무것도 안 바뀌었다', [v.qty, v.exReq, v.exIn], [10, undefined, undefined]);
}

console.log('\n── 세는 함수는 아무것도 바꾸지 않는다 ──');
{
  const {DB, v, p, applyCaseStock, failOpen, failWait, pFailOpen, pFailWait, pExIn, vBook} = 새판();
  applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12',fail:true}], '일반', 'a');
  const 찍기 = () => JSON.stringify(DB.implants);
  const 전 = 찍기();
  const 본것 = [failOpen(v), failWait(v), pFailOpen(p), pFailWait(p), pExIn(p), vBook(v)];
  ok('세어도 재고가 안 바뀐다',   찍기(), 전);
  ok('여러 번 세도 값이 같다',    [failOpen(v), failWait(v), pFailOpen(p), pFailWait(p), pExIn(p), vBook(v)], 본것);
  ok('장부가 현재고와 같다',      vBook(v), v.qty);
}

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
process.exit(fail?1:0);
