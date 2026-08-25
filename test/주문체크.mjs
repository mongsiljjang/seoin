/* 주문 체크 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.

   재고가 떨어져 가는 걸 아는 사람이 그 자리에서 체크하고, 실장이 모인
   목록을 보고 담당 영업사원에게 카톡으로 주문한다 (통화록 1-6장).

   지켜야 할 것 — 체크도 주문 표시도 정리도 재고를 건드리지 않는다.
   재고가 움직이는 자리는 물건이 와서 ＋입고할 때 하나뿐이다.

   돌리는 법:  node test/주문체크.mjs        (설치 필요 없음) */
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
const 떼올것=['reqKey','reqFor','addReq','dropReq','openReqs','markOrdered','clearOrdered','reqStock','kakaoText',
  'usageStats','forecast','needsOrder','appPicks','markPickOrdered','suggestQty'];

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want); y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };

function 새판(){
  const DB={ hospName:'서인치과',
    inventory:[{id:'g1', name:'알콜솜', qty:8, minQty:15, unit:'통', vendor:'A메디칼'}],
    implants:[{id:'p1', brand:'오스템', line:'TS III', part:'픽스처', vendor:'A덴탈', variants:[
      {id:'v1', label:'4.0×12', qty:2, minQty:5, inTot:10, uNor:8, uIns:0, uFail:0}]}],
    orderReqs:[], invLogs:[], implantLogs:[] };
  const f=new Function('DB', `let _t=0; const now=()=>++_t, uid=()=>'id'+_t;
const DAY_MS=86400000; const tms=v=>+new Date(v);
${떼올것.map(grab).join('\n')}
return {reqFor,addReq,dropReq,openReqs,markOrdered,clearOrdered,reqStock,kakaoText,appPicks,markPickOrdered,suggestQty};`)(DB);
  return { DB, it:DB.inventory[0], v:DB.implants[0].variants[0], ...f };
}
const 재고찍기 = DB => JSON.stringify([DB.inventory, DB.implants]);

console.log('\n── 체크·주문·정리는 재고를 건드리지 않는다 ──');
{
  const {DB, addReq, markOrdered, clearOrdered, dropReq} = 새판();
  const 전 = 재고찍기(DB);
  const r = addReq('gen','g1','알콜솜','A메디칼','김간호','한 통 남았어요');
  ok('체크해도 재고 그대로',        재고찍기(DB), 전);
  markOrdered(r.id, '실장');
  ok('주문 표시해도 그대로',        재고찍기(DB), 전);
  clearOrdered(r.id);
  ok('정리해도 그대로',             재고찍기(DB), 전);
  addReq('imp','p1|v1','오스템 4.0×12','A덴탈','박물리','');
  dropReq('imp','p1|v1','박물리');
  ok('임플란트 쪽도 그대로',        재고찍기(DB), 전);
}

console.log('\n── 여러 명이 누르면 한 줄로 모은다 ──');
{
  const {DB, addReq, reqFor, openReqs} = 새판();
  addReq('gen','g1','알콜솜','A메디칼','김간호','');
  addReq('gen','g1','알콜솜','A메디칼','박물리','거의 없어요');
  addReq('gen','g1','알콜솜','A메디칼','이원무','');
  ok('목록엔 한 줄',                openReqs().length, 1);
  ok('세 명이 센다',                reqFor('gen','g1').reqs.length, 3);
  addReq('gen','g1','알콜솜','A메디칼','김간호','메모 바꿈');
  ok('같은 사람이 또 눌러도 안 는다', reqFor('gen','g1').reqs.length, 3);
  ok('대신 메모는 바뀐다',          reqFor('gen','g1').reqs.find(x=>x.by==='김간호').memo, '메모 바꿈');
}

console.log('\n── 내 체크만 뺀다 ──');
{
  const {addReq, dropReq, reqFor, openReqs} = 새판();
  addReq('gen','g1','알콜솜','A메디칼','김간호','');
  addReq('gen','g1','알콜솜','A메디칼','박물리','');
  dropReq('gen','g1','김간호');
  ok('한 명이 빼도 줄은 남는다',    reqFor('gen','g1').reqs.map(x=>x.by), ['박물리']);
  dropReq('gen','g1','박물리');
  ok('마지막이 빼면 줄이 사라진다', openReqs().length, 0);
  ok('안 체크한 사람이 빼면 무시',  dropReq('gen','g1','이원무'), false);
}

console.log('\n── 실장 흐름 — 주문함 · 정리 ──');
{
  const {DB, addReq, markOrdered, clearOrdered, openReqs} = 새판();
  const r=addReq('gen','g1','알콜솜','A메디칼','김간호','');
  markOrdered(r.id,'실장');
  ok('주문하면 목록에서 빠진다',    openReqs().length, 0);
  ok('주문한 것 표시가 남는다',     DB.orderReqs.filter(x=>x.status==='ordered').length, 1);
  ok('누가 주문했는지 남는다',      DB.orderReqs[0].orderedBy, '실장');
  clearOrdered(r.id);
  ok('정리하면 완전히 사라진다',    DB.orderReqs.length, 0);
  ok('없는 것 정리는 무시',         clearOrdered('없음'), false);
}

console.log('\n── 숫자는 그 자리에서 읽는다 — 저장하면 낡는다 ──');
{
  const {DB, addReq, reqStock, reqFor} = 새판();
  addReq('gen','g1','알콜솜','A메디칼','김간호','');
  ok('일반재고를 읽는다',           reqStock(reqFor('gen','g1')), {qty:8,min:15,unit:'통'});
  DB.inventory[0].qty=3;                        // 체크 뒤에 더 썼다
  ok('바뀐 재고가 그대로 보인다',   reqStock(reqFor('gen','g1')).qty, 3);
  addReq('imp','p1|v1','오스템 4.0×12','A덴탈','박물리','');
  ok('임플란트 규격도 읽는다',      reqStock(reqFor('imp','p1|v1')), {qty:2,min:5,unit:'개'});
  ok('없는 품목이면 null',          reqStock({kind:'gen',refId:'없음'}), null);
}

console.log('\n── 카톡용 글 ──');
{
  const {addReq, openReqs, kakaoText} = 새판();
  addReq('gen','g1','알콜솜','A메디칼','김간호','');
  addReq('imp','p1|v1','오스템 TS III 4.0×12','A덴탈','박물리','');
  const 메디칼=kakaoText('A메디칼', openReqs().filter(r=>r.vendor==='A메디칼'));
  ok('병원 이름이 들어간다',        메디칼.includes('서인치과'), true);
  ok('거래처가 들어간다',           메디칼.includes('A메디칼'), true);
  ok('품목이 들어간다',             메디칼.includes('알콜솜'), true);
  ok('남은 것이 들어간다',          메디칼.includes('8통 남음'), true);
  ok('다른 거래처 것은 안 섞인다',  메디칼.includes('4.0×12'), false);
  const 덴탈=kakaoText('A덴탈', openReqs().filter(r=>r.vendor==='A덴탈'));
  ok('임플란트 쪽 글도 나온다',     덴탈.includes('오스템 TS III') && 덴탈.includes('- 4.0×12'), true);
}

console.log('\n── 앱이 골랐어요 — 열 때마다 고르고, 저장하지 않는다 ──');
{
  const {DB, appPicks} = 새판();
  ok('최소에 닿은 일반재고를 고른다',   appPicks().some(p=>p.kind==='gen'&&p.refId==='g1'), true);
  ok('최소에 닿은 임플란트도 고른다',   appPicks().some(p=>p.kind==='imp'&&p.refId==='p1|v1'), true);
  ok('임플란트 이름이 온전하다',        appPicks().find(p=>p.kind==='imp').label, '오스템 TS III 4.0×12');
  ok('거래처가 붙는다',                 appPicks().find(p=>p.refId==='g1').vendor, 'A메디칼');
  DB.inventory[0].qty=100;                       // 물건이 와서 ＋입고했다
  ok('입고되면 다음에 열 때 빠진다',    appPicks().some(p=>p.refId==='g1'), false);
}
{
  const {appPicks, addReq} = 새판();
  addReq('gen','g1','알콜솜','A메디칼','김간호','');
  ok('사람이 체크한 품목은 안 고른다',  appPicks().some(p=>p.refId==='g1'), false);
  ok('다른 품목은 그대로 고른다',       appPicks().some(p=>p.refId==='p1|v1'), true);
}
{
  const {DB, appPicks} = 새판();
  DB.implants[0].variants.push({id:'v2', label:'4.5×10', qty:0, minQty:0});
  ok('최소가 없는 규격 칸은 안 고른다', appPicks().some(p=>p.refId==='p1|v2'), false);
}

console.log('\n── 소진 예측(주문임박)도 고른다 ──');
{
  const {DB, appPicks} = 새판();
  const it=DB.inventory[0]; it.qty=10; it.minQty=2;              // 최소보다 넉넉하다
  ok('넉넉하면 안 고른다',              appPicks().some(p=>p.refId==='g1'), false);
  it.counts=[{at:0, qty:20},{at:8*86400000, qty:10, used:10}];   // 8일에 10통 → 곧 최소에 닿는다
  const p=appPicks().find(x=>x.refId==='g1');
  ok('써 온 속도로 곧 닿으면 고른다',   !!p, true);
  ok('왜 골랐는지 말한다',              /써 온 속도면 \d+일 뒤 주문할 때예요/.test(p.why), true);
}

console.log('\n── 앱이 고른 것의 주문했어요 — 재고는 그대로다 ──');
{
  const {DB, appPicks, markPickOrdered, addReq} = 새판();
  const 전 = 재고찍기(DB);
  const r=markPickOrdered('gen','g1','알콜솜','A메디칼','실장');
  ok('주문함에 들어간다',               DB.orderReqs.filter(x=>x.status==='ordered').length, 1);
  ok('앱이 고른 표시가 남는다',         r.app, true);
  ok('누가 주문했는지 남는다',          r.orderedBy, '실장');
  ok('주문함에 있는 동안 다시 안 고른다', appPicks().some(p=>p.refId==='g1'), false);
  ok('재고는 그대로다',                 재고찍기(DB), 전);
  addReq('imp','p1|v1','오스템 TS III 4.0×12','A덴탈','김간호','');
  ok('그새 사람이 체크했으면 그 줄이 우선', markPickOrdered('imp','p1|v1','오스템 TS III 4.0×12','A덴탈','실장'), null);
}

console.log('\n── 앱이 고른 것도 같은 카톡 글로 나간다 ──');
{
  const {appPicks, kakaoText} = 새판();
  const 글=kakaoText('A메디칼', appPicks().filter(p=>p.vendor==='A메디칼'));
  ok('품목이 들어간다',                 글.includes('알콜솜'), true);
  ok('개수 제안과 남은 것이 들어간다',  글.includes('- 알콜솜 7통 (8통 남음)'), true);
}

console.log('\n── 카톡 글은 제품으로 묶는다 — 접두어를 줄마다 반복하지 않는다 ──');
{
  const {DB, appPicks, kakaoText} = 새판();
  DB.implants[0].variants.push({id:'v2', label:'4.5×10', qty:0, minQty:3});
  const 글=kakaoText('A덴탈', appPicks().filter(p=>p.vendor==='A덴탈'));
  ok('제품 이름은 한 번만 나온다',      글.split('오스템 TS III').length-1, 1);
  ok('규격이 그 아래 줄로 나온다',      글.includes('- 4.0×12') && 글.includes('- 4.5×10'), true);
  ok('0개짜리도 개수를 제안한다',       글.includes('- 4.5×10 3개 (0개 남음)'), true);
}

console.log('\n── 주문 개수 제안 — 지난 입고량 평균, 없으면 평소까지 채움 ──');
{
  const {DB, suggestQty, kakaoText, appPicks} = 새판();
  ok('기록이 없으면 평소까지 채운다',   suggestQty('gen','g1'), 7);           // 15 − 8
  ok('임플란트도 같다',                 suggestQty('imp','p1|v1'), 3);        // 5 − 2
  DB.invLogs=[{itemId:'g1',type:'in',amount:20},{itemId:'g1',type:'out',amount:999},{itemId:'g1',type:'in',amount:10}];
  ok('입고량 평균으로 제안한다',        suggestQty('gen','g1'), 15);          // (20+10)/2
  ok('출고 기록은 안 섞는다',           suggestQty('gen','g1'), 15);
  DB.implantLogs=[{pid:'p1',vid:'v1',type:'in',amount:5},{pid:'p1',vid:'v1',type:'in',amount:3}];
  ok('임플란트 입고 기록도 읽는다',     suggestQty('imp','p1|v1'), 4);
  DB.inventory.push({id:'g2', name:'솜', qty:0, minQty:0, unit:'개'});
  ok('평소 유지량이 없으면 제안 없음',  suggestQty('gen','g2'), 0);
  const 글=kakaoText('A메디칼', appPicks().filter(p=>p.vendor==='A메디칼'));
  ok('제안이 카톡 글에 실린다',         글.includes('- 알콜솜 15통 (8통 남음)'), true);
}

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
process.exit(fail?1:0);
