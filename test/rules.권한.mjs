import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, deleteDoc, collection, getDocs } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-mediops',
  firestore: { host:'127.0.0.1', port:8080, rules: fs.readFileSync('firestore.rules','utf8') }
});

let pass=0, fail=0;
async function ok(name, p){ try{ await assertSucceeds(p); pass++; console.log('✅ '+name); }
                            catch(e){ fail++; console.log('❌ '+name+'  — 되어야 하는데 막힘'); } }
async function no(name, p){ try{ await assertFails(p); pass++; console.log('✅ '+name); }
                            catch(e){ fail++; console.log('❌ '+name+'  — 막혀야 하는데 됨'); } }
const D=(...a)=>doc(...a);
const WS='clinic';
const P=(db,...seg)=>doc(db,'hospapp',WS,...seg);

async function seed(fn){ await env.withSecurityRulesDisabled(ctx=>fn(ctx.firestore())); }
async function reset(){ await env.clearFirestore(); }

const 원장 = ()=>env.authenticatedContext('owner1').firestore();
const 직원 = ()=>env.authenticatedContext('staff1').firestore();
const 낯선이 = ()=>env.authenticatedContext('stranger').firestore();
const 제작자 = ()=>env.authenticatedContext('op1').firestore();
const 퇴직자 = ()=>env.authenticatedContext('leaver').firestore();

async function 기본세팅(extra){
  await seed(async db=>{
    await setDoc(D(db,'operators','op1'), {name:'제작자'});
    await setDoc(P(db,'claims','owner1'), {approved:true, role:'관리자', staffId:'s1'});
    await setDoc(P(db,'claims','staff1'), {approved:true, role:'직원', staffId:'s2'});
    await setDoc(P(db,'roster','main'), {staff:[{id:'s1'},{id:'s2'}]});
    await setDoc(P(db,'shared','main'), {inventory:[]});
    await setDoc(P(db,'secrets','main'), {pins:{}});
    await setDoc(P(db,'people','s1'), {pay:1});
    await setDoc(P(db,'people','s2'), {pay:2});
    if(extra) await extra(db);
  });
}

console.log('\n── 예전 동작이 그대로인가 ──');
await reset(); await 기본세팅();
await ok ('승인된 직원은 재고를 읽는다',        getDoc(P(직원(),'shared','main')));
await ok ('승인된 직원은 명단을 읽는다',        getDoc(P(직원(),'roster','main')));
await no ('직원은 PIN 을 못 읽는다',            getDoc(P(직원(),'secrets','main')));
await ok ('직원은 자기 급여를 읽는다',          getDoc(P(직원(),'people','s2')));
await no ('직원은 남의 급여를 못 읽는다',       getDoc(P(직원(),'people','s1')));
await no ('승인 안 된 기기는 아무것도 못 읽는다', getDoc(P(낯선이(),'shared','main')));
await no ('직원은 스스로 관리자가 못 된다',
          setDoc(P(직원(),'claims','staff1'), {approved:true, role:'관리자'}));

console.log('\n── 개통 승인 ──');
await reset();
await seed(async db=>{ await setDoc(D(db,'operators','op1'), {name:'제작자'}); });
await ok ('설정이 없으면 예전처럼 첫 관리자가 열린다',
          setDoc(P(낯선이(),'claims','stranger'), {approved:true, role:'관리자', staffId:'x'}));
await reset();
await seed(async db=>{
  await setDoc(D(db,'operators','op1'), {name:'제작자'});
  await setDoc(D(db,'config','main'), {requireApproval:true});
});
await no ('승인을 켜면 등록 안 된 병원은 못 연다',
          setDoc(P(낯선이(),'claims','stranger'), {approved:true, role:'관리자', staffId:'x'}));
await ok ('개설 신청은 남길 수 있다',
          setDoc(D(낯선이(),'hospreq',WS), {name:'포항치과', contact:'010', at:1}));
await no ('신청서에 딴 것을 끼워 넣을 수 없다',
          setDoc(D(낯선이(),'hospreq','other'), {name:'x', contact:'y', at:1, secret:'z'}));
await no ('신청 목록은 제작자만 본다', getDocs(collection(낯선이(),'hospreq')));
await ok ('제작자는 신청 목록을 본다',  getDocs(collection(제작자(),'hospreq')));
await seed(async db=>{ await setDoc(D(db,'hospitals',WS), {name:'포항치과', approved:true}); });
await no ('병원 목록은 제작자만 훑는다', getDocs(collection(낯선이(),'hospitals')));
await ok ('제작자는 병원 목록을 훑는다',  getDocs(collection(제작자(),'hospitals')));
await ok ('승인하면 열린다',
          setDoc(P(낯선이(),'claims','stranger'), {approved:true, role:'관리자', staffId:'x'}));

console.log('\n── 구독 기한 ──');
const 미래 = new Date(Date.now()+30*86400000), 과거 = new Date(Date.now()-86400000);
await reset(); await 기본세팅();
await ok ('기한 문서가 없으면 그냥 쓴다', getDoc(P(직원(),'shared','main')));
await reset(); await 기본세팅(async db=>{ await setDoc(P(db,'license','main'), {paidUntil:미래, status:'active'}); });
await ok ('기한이 남아 있으면 쓴다', getDoc(P(직원(),'shared','main')));
await reset(); await 기본세팅(async db=>{ await setDoc(P(db,'license','main'), {paidUntil:과거, status:'active'}); });
await no ('기한이 지나면 재고가 막힌다',   getDoc(P(직원(),'shared','main')));
await no ('기한이 지나면 명단도 막힌다',   getDoc(P(직원(),'roster','main')));
await no ('기한이 지나면 급여도 막힌다',   getDoc(P(원장(),'people','s1')));
await no ('기한이 지나면 쓰기도 막힌다',   setDoc(P(원장(),'shared','main'), {x:1}));
await ok ('기한이 지나도 내 등록은 읽힌다', getDoc(P(직원(),'claims','staff1')));
await ok ('기한이 지나도 남은 기간은 읽힌다', getDoc(P(직원(),'license','main')));
await reset(); await 기본세팅(async db=>{ await setDoc(P(db,'license','main'), {paidUntil:미래, status:'suspended'}); });
await no ('정지시키면 기한이 남아도 막힌다', getDoc(P(직원(),'shared','main')));

console.log('\n── 제작자가 볼 수 있는 것과 없는 것 ──');
await reset(); await 기본세팅(async db=>{ await setDoc(P(db,'license','main'), {paidUntil:미래}); });
await ok ('제작자는 기한을 고친다',        setDoc(P(제작자(),'license','main'), {paidUntil:미래, status:'active'}));
await no ('원장도 기한은 못 고친다',       setDoc(P(원장(),'license','main'), {paidUntil:미래}));
await no ('제작자는 직원 명단을 못 본다',  getDoc(P(제작자(),'roster','main')));
await no ('제작자는 PIN 을 못 본다',       getDoc(P(제작자(),'secrets','main')));
await no ('제작자는 급여를 못 본다',       getDoc(P(제작자(),'people','s1')));
await no ('제작자는 재고를 못 본다',       getDoc(P(제작자(),'shared','main')));
await no ('제작자도 비밀번호는 못 읽는다', getDoc(P(제작자(),'ownerkey','main')));
await seed(async db=>{ await setDoc(P(db,'ownerkey','main'), {hash:'H'}); });
await ok ('제작자는 비밀번호를 지울 수 있다', deleteDoc(P(제작자(),'ownerkey','main')));
await ok ('제작자는 기록을 남긴다',        setDoc(P(제작자(),'opslog','r1'), {what:'비밀번호 초기화', at:1}));
await ok ('병원은 그 기록을 본다',         getDoc(P(원장(),'opslog','r1')));
await no ('병원은 그 기록을 못 고친다',    setDoc(P(원장(),'opslog','r1'), {what:'지움'}));
await no ('제작자 문서는 앱에서 못 만든다', setDoc(D(낯선이(),'operators','stranger'), {x:1}));

console.log('\n── 계량기 (한도와 쓴 양) ──');
await reset(); await 기본세팅(async db=>{ await setDoc(P(db,'license','main'), {paidUntil:미래, maxStaff:5, maxScanPerDay:3}); });
await ok ('관리자가 쓴 양을 적는다',       setDoc(P(원장(),'usage','main'), {staffCount:7}));
await no ('직원은 쓴 양을 못 적는다',      setDoc(P(직원(),'usage','main'), {staffCount:1}));
await ok ('제작자는 쓴 양을 읽는다',       getDoc(P(제작자(),'usage','main')));
await ok ('병원도 자기 쓴 양을 읽는다',    getDoc(P(원장(),'usage','main')));
// 여기가 나눠 둔 이유다 — 쓴 양은 병원이 적지만 한도는 못 건드린다.
await no ('원장은 자기 한도를 못 늘린다',  setDoc(P(원장(),'license','main'), {maxScanPerDay:999}));
await ok ('제작자는 한도를 정한다',        setDoc(P(제작자(),'license','main'), {maxStaff:15, maxScanPerDay:10}));
await ok ('병원은 자기 한도를 읽는다',     getDoc(P(원장(),'license','main')));
// 쓴 양에 명단이 섞여 들어가도 규칙은 못 막는다. 막는 것은 앱이고,
// 규칙이 지키는 것은 '제작자가 명단 문서를 못 읽는다' 쪽이다.
await no ('제작자는 그래도 명단을 못 본다', getDoc(P(제작자(),'roster','main')));

console.log('\n── 복구 코드 ──');
await reset();
await seed(async db=>{
  await setDoc(P(db,'roster','main'), {staff:[{id:'s1'}]});
  await setDoc(P(db,'ownerkey','main'), {hash:'정답', codes:['코드1','코드2']});
});
await ok ('답안은 누구나 적어낼 수 있다', setDoc(P(낯선이(),'unlock','stranger'), {key:'코드1'}));
await ok ('맞는 코드면 관리자로 들어온다',
          setDoc(P(낯선이(),'claims','stranger'), {approved:true, role:'관리자', staffId:'s1'}));
await reset();
await seed(async db=>{
  await setDoc(P(db,'roster','main'), {staff:[{id:'s1'}]});
  await setDoc(P(db,'ownerkey','main'), {hash:'정답', codes:['코드1','코드2']});
  await setDoc(P(db,'unlock','stranger'), {key:'엉뚱한값'});
});
await no ('틀린 코드로는 못 들어온다',
          setDoc(P(낯선이(),'claims','stranger'), {approved:true, role:'관리자', staffId:'s1'}));
await no ('답안은 아무도 못 읽는다', getDoc(P(원장(),'unlock','stranger')));

console.log('\n── 사직서 링크 ──');
await reset(); await 기본세팅();
await ok ('관리자가 링크를 발급한다',
          setDoc(P(원장(),'resigninv','TOKEN1'), {name:'홍길동', joinDate:'2024-01-02', at:1}));
await no ('직원은 링크를 못 만든다',
          setDoc(P(직원(),'resigninv','TOKEN2'), {name:'x'}));
await ok ('주소를 아는 퇴직자는 그 링크를 연다', getDoc(P(퇴직자(),'resigninv','TOKEN1')));
await no ('링크 목록은 관리자만 훑는다', getDocs(collection(퇴직자(),'hospapp',WS,'resigninv')));
await ok ('퇴직자가 사직서를 낸다',
          setDoc(P(퇴직자(),'resignsub','TOKEN1'), {reason:'개인 사정', agreed:true, at:1}));
await no ('두 번은 못 낸다',
          setDoc(P(퇴직자(),'resignsub','TOKEN1'), {reason:'고침', agreed:true, at:2}));
await no ('없는 링크로는 못 낸다',
          setDoc(P(퇴직자(),'resignsub','TOKEN9'), {reason:'x', agreed:true, at:1}));
await no ('낸 사람도 다시 못 읽는다', getDoc(P(퇴직자(),'resignsub','TOKEN1')));
await ok ('관리자는 받은 것을 읽는다',  getDoc(P(원장(),'resignsub','TOKEN1')));
await no ('퇴직자는 그 외 아무것도 못 본다', getDoc(P(퇴직자(),'roster','main')));
await no ('퇴직자는 재고도 못 본다',        getDoc(P(퇴직자(),'shared','main')));

console.log(`\n${pass} 통과 / ${fail} 실패`);
await env.cleanup();
process.exit(fail?1:0);
