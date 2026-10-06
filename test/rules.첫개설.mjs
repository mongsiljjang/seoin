import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
const env = await initializeTestEnvironment({ projectId:'demo-mediops',
  firestore:{ host:'127.0.0.1', port:8080, rules: fs.readFileSync('firestore.rules','utf8') }});
let pass=0, fail=0;
const ok=async(n,p)=>{try{await assertSucceeds(p);pass++;console.log('✅ '+n);}catch(e){fail++;console.log('❌ '+n+'  ← 되어야 하는데 막힘');}};
const WS='clinic', P=(db,...s)=>doc(db,'hospapp',WS,...s);
const 기기=()=>env.authenticatedContext('dev1').firestore();
const 관리자만들기 = db => setDoc(P(db,'claims','dev1'),
  {staffId:'s1', name:'원장', phone:'01011112222', role:'관리자', approved:true, at:1, device:'pc'});

async function seed(신청남아있음){
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async c=>{
    const db=c.firestore();
    // 지금 몽실쌤 상태: roster 는 비었고, 옛 단일 문서에는 자료가 남아 있다
    await setDoc(doc(db,'hospapp',WS), {db:'{"staff":[...]}', updatedAt:1});
    await setDoc(P(db,'meta','main'), {hasClinic:true, ownerSalt:'SALT'});
    if(신청남아있음) await setDoc(P(db,'claims','dev1'), {phone:'010', approved:false, at:1});
  });
}

console.log('\n── 명단을 지운 뒤 관리자 만들기 ──');
await seed(false);
await ok('① 신청 기록이 없는 기기', 관리자만들기(기기()));

await seed(true);
await ok('② 승인 대기 신청이 남아 있는 기기 (그냥 누르면)', 관리자만들기(기기()));

await seed(true);
const db2=기기();
await ok('③ 신청을 먼저 취소하고 누르면', (async()=>{
  await deleteDoc(P(db2,'claims','dev1'));
  await 관리자만들기(db2);
})());

console.log(`\n${pass} 통과 / ${fail} 실패`);
await env.cleanup(); process.exit(0);
