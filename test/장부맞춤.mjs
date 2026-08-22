/* 장부 식 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.

   매입 + 교환입고 + 보정 − 사용 = 현재고

   보정 칸이 없던 시절에는 '매입 50 · 사용 0 인데 현재고 65' 같은 일이
   생겼다. 15개가 어디서 왔는지 화면 어디에도 없었다. 조용히 늘어난 재고를
   잡아내는 것이 이 앱이 하는 일인데 정작 앱이 그것을 저지르고 있었다.

   매입에 얹지 않는 이유 — 사지도 않은 것이 매입으로 잡히면 원가가 흐려진다.
   그것도 결국 숨기는 것이다.

   돌리는 법:  node test/장부맞춤.mjs        (설치 필요 없음) */
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
const 떼올것 = ['parseDL','findVar','caseTally','applyCaseStock','implantLog','vUse','vAdj','vBook',
                'bumpAdj','exReq','exIn','failOpen','failWait','claimFail','receiveFail',
                'pIn','pQty','pUse','pAdj','backfillAdj'];

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want); y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };

function 새판(variants){
  const DB={ implants:[{id:'p1', brand:'오스템', part:'픽스처', variants: variants || [
      {id:'v1', label:'4.0×12', qty:10, minQty:2, inTot:10, uNor:0,uIns:0,uFail:0, phys:null}]}],
    implantCases:[], implantLogs:[] };
  const f=new Function('DB', `const now=()=>1, uid=()=>'x';
const implantById=id=>DB.implants.find(p=>p.id===id);
${떼올것.map(grab).join('\n')}
return {applyCaseStock,vBook,vAdj,vUse,bumpAdj,claimFail,receiveFail,pIn,pQty,pUse,pAdj,backfillAdj};`)(DB);
  return { DB, p:DB.implants[0], v:DB.implants[0].variants[0], ...f };
}
// 장부 식이 맞는가
const 맞나 = (f,v) => f.vBook(v) === v.qty;

console.log('\n── 장부 식: 매입 + 교환입고 + 보정 − 사용 = 현재고 ──');
{
  const f = 새판(); const {v} = f;
  ok('처음엔 맞는다',        맞나(f,v), true);
  f.applyCaseStock([], '', [{fdi:'46',fx:'오스템 4.0×12'}], '일반', 'a');
  ok('사용해도 맞는다',      맞나(f,v), true);
  f.applyCaseStock([], '', [{fdi:'36',fx:'오스템 4.0×12',fail:true}], '보험', 'b');
  ok('페일이 나도 맞는다',   맞나(f,v), true);
  f.claimFail('p1','v1',1); f.receiveFail('p1','v1',1);
  ok('교환으로 받아도 맞는다', 맞나(f,v), true);
}

console.log('\n── 손으로 고친 몫은 보정으로 간다 ──');
{
  const f = 새판(); const {v} = f;
  f.bumpAdj(v, 5); v.qty += 5;
  ok('보정이 쌓인다',        f.vAdj(v), 5);
  ok('장부 식이 맞는다',     맞나(f,v), true);
  ok('매입은 안 늘었다',     v.inTot, 10);      // 사지 않았다
  ok('사용도 안 늘었다',     f.vUse(v), 0);
  f.bumpAdj(v, -2); v.qty -= 2;
  ok('줄이는 보정도 된다',   f.vAdj(v), 3);
  ok('여전히 맞는다',        맞나(f,v), true);
  ok('0 이면 안 쌓는다',     (f.bumpAdj(v,0), f.vAdj(v)), 3);
}

console.log('\n── 옛 데이터 되메움 — 15개가 어디서 왔는지 이름을 붙인다 ──');
{
  // 실제로 있던 모양: 매입 50 · 사용 0 · 현재고 65
  const f = 새판([{id:'v1', label:'4.0×12', qty:65, inTot:50, uNor:0,uIns:0,uFail:0, phys:null}]);
  const {DB, v, p} = f;
  ok('되메움 전에는 어긋나 있다', 맞나(f,v), false);
  ok('어긋난 몫이 15',            v.qty - f.vBook(v), 15);

  f.backfillAdj();
  ok('되메움 뒤에는 맞는다',      맞나(f,v), true);
  ok('15개가 보정으로 들어왔다',  f.vAdj(v), 15);
  ok('매입은 그대로 50',          v.inTot, 50);      // 사지 않은 것을 산 것으로 만들지 않는다
  ok('현재고도 그대로 65',        v.qty, 65);        // 재고 숫자는 손대지 않는다
  ok('기록이 남는다',             DB.implantLogs.some(l=>/이전 기록 정리/.test(l.memo)), true);

  const 전 = f.vAdj(v);
  f.backfillAdj();
  ok('두 번 돌려도 안 쌓인다',    f.vAdj(v), 전);
}
{
  const f = 새판();   // 이미 맞는 데이터
  const {DB, v} = f;
  f.backfillAdj();
  ok('맞는 데이터는 안 건드린다', [f.vAdj(v), DB.implantLogs.length], [0, 0]);
}

console.log('\n── 제품 합계에도 보정이 보인다 ──');
{
  const f = 새판([
    {id:'v1', label:'4.0×12', qty:65, inTot:50, uNor:0,uIns:0,uFail:0},
    {id:'v2', label:'4.0×10', qty:10, inTot:10, uNor:0,uIns:0,uFail:0}]);
  const {p} = f;
  f.backfillAdj();
  ok('제품 보정 합계',   f.pAdj(p), 15);
  ok('제품 매입 합계',   f.pIn(p),  60);
  ok('제품 현재고 합계', f.pQty(p), 75);
  ok('매입+보정−사용 = 현재고', f.pIn(p)+f.pAdj(p)-f.pUse(p), f.pQty(p));
}

console.log('\n── 되메움은 기록 자리가 준비된 뒤에 돈다 ──');
{
  // ensureSchema 에서 implantLogs 보다 먼저 부르면 기록하다 터진다. 실제로 그랬다.
  const src = html;
  const iLogs = src.indexOf("if(!Array.isArray(DB.implantLogs)) DB.implantLogs=[];");
  const iBack = src.indexOf('backfillAdj();');
  ok('implantLogs 를 먼저 만든다', iLogs>=0 && iBack>iLogs, true);
}
{
  // 기록 자리가 없으면 조용히 넘어가야지 터지면 앱이 안 열린다
  const f = 새판([{id:'v1',label:'4.0×12',qty:65,inTot:50,uNor:0,uIns:0,uFail:0}]);
  f.DB.implantLogs = undefined;
  let 터졌나=false;
  try{ f.backfillAdj(); }catch(e){ 터졌나=true; }
  ok('기록 자리가 없어도 안 터진다', 터졌나, false);
}

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
process.exit(fail?1:0);
