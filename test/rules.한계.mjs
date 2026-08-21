import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-worst',
  firestore:{ host:'127.0.0.1', port:8080, rules: fs.readFileSync('firestore.rules','utf8') } });
let pass=0, fail=0;
const ok=async(n,p)=>{ try{ await assertSucceeds(p); pass++; console.log('✅ '+n); }
                       catch(e){ fail++; console.log('❌ '+n+' — '+String(e.message||e).slice(0,140)); } };
const no=async(n,p)=>{ try{ await assertFails(p); pass++; console.log('✅ '+n); }
                       catch(e){ fail++; console.log('❌ '+n+' — 막혀야 하는데 됨'); } };
const WS='posco';
const P=(db,...s)=>doc(db,'hospapp',WS,...s);
const seed=fn=>env.withSecurityRulesDisabled(c=>fn(c.firestore()));
const 새기기=()=>env.authenticatedContext('newdev').firestore();
const 원장=()=>env.authenticatedContext('owner1').firestore();
const 미래=new Date(Date.now()+30*86400000);

console.log('\n── 조건이 가장 많이 겹칠 때 (문서 조회 10개 제한) ──');
await env.clearFirestore();
// 개통 승인 켜짐 + 병원 등록 + 구독 살아있음 + 복구문 있음 + 열쇠 있음 — 전부 걸린 상태
await seed(async db=>{
  await setDoc(doc(db,'config','main'), {requireApproval:true});
  await setDoc(doc(db,'hospitals',WS), {name:'포항치과', approved:true});
  await setDoc(doc(db,'operators','op1'), {name:'제작자'});
  await setDoc(P(db,'license','main'), {paidUntil:미래, status:'active'});
  await setDoc(P(db,'recovery','open'), {open:false});
  await setDoc(P(db,'ownerkey','main'), {hash:'H', codes:['C1','C2','C3','C4','C5','C6','C7','C8']});
  await setDoc(P(db,'unlock','newdev'), {key:'엉뚱'});
});
await ok('첫 관리자 등록 — 조건 다 걸려도 통과',
  setDoc(P(새기기(),'claims','newdev'), {approved:true, role:'관리자', staffId:'s1'}));
await ok('개설 때 명단 쓰기 — 조건 다 걸려도 통과',
  setDoc(P(새기기(),'roster','main'), {staff:[{id:'s1'}]}));
await ok('개설 때 PIN 쓰기',   setDoc(P(새기기(),'secrets','main'), {pins:{}}));
await ok('개설 때 급여 쓰기',  setDoc(P(새기기(),'people','s1'), {pay:1}));
await ok('개설 때 재고 쓰기',  setDoc(P(새기기(),'shared','main'), {inventory:[]}));
// 계량기는 meta 와 같은 조건(isAdmin || bootstrapAllowed)이라 조회 개수도 같다.
// 조건이 다 걸린 자리에서 한 번 확인해 둔다 — 여기서 터지면 병원이 잠긴다.
await ok('개설 때 계량기 쓰기', setDoc(P(새기기(),'usage','main'), {staffCount:1}));

console.log('\n── 명단이 생긴 뒤 (관리자 경로) ──');
await ok('관리자가 명단을 읽는다', getDoc(P(새기기(),'roster','main')));
await ok('관리자가 명단을 고친다', setDoc(P(새기기(),'roster','main'), {staff:[{id:'s1'},{id:'s2'}]}));
await ok('관리자가 급여를 읽는다', getDoc(P(새기기(),'people','s1')));
await no('명단이 생겼으니 다른 기기는 스스로 관리자가 못 된다',
  setDoc(P(원장(),'claims','owner1'), {approved:true, role:'관리자', staffId:'s9'}));

console.log('\n── 복구 문까지 열린 최악 ──');
await seed(async db=>{ await setDoc(P(db,'recovery','open'), {open:true}); });
await ok('복구 문이 열리면 다시 첫 관리자가 된다',
  setDoc(P(원장(),'claims','owner1'), {approved:true, role:'관리자', staffId:'s9'}));
await ok('그 상태에서 명단 쓰기도 된다',
  setDoc(P(원장(),'roster','main'), {staff:[{id:'s9'}]}));
await ok('그 상태에서 계량기 쓰기도 된다',
  setDoc(P(원장(),'usage','main'), {staffCount:2}));

console.log(`\n${pass} 통과 / ${fail} 실패`);
await env.cleanup(); process.exit(fail?1:0);
