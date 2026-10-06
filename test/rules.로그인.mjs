import fs from 'fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const env = await initializeTestEnvironment({
  projectId: 'demo-mediops',
  firestore: { host:'127.0.0.1', port:8080, rules: fs.readFileSync('firestore.rules','utf8') }
});
let pass=0, fail=0;
const ok=async(n,p)=>{try{await assertSucceeds(p);pass++;console.log('✅ '+n);}catch(e){fail++;console.log('❌ '+n+' — 되어야 하는데 막힘');}};
const no=async(n,p)=>{try{await assertFails(p);pass++;console.log('✅ '+n);}catch(e){fail++;console.log('❌ '+n+' — 막혀야 하는데 됨');}};
const WS='clinic';
const P=(db,...s)=>doc(db,'hospapp',WS,...s);
const 새직원=()=>env.authenticatedContext('newstaff').firestore();
const 원장=()=>env.authenticatedContext('owner1').firestore();

await env.clearFirestore();
await env.withSecurityRulesDisabled(async ctx=>{
  const db=ctx.firestore();
  await setDoc(P(db,'claims','owner1'), {approved:true, role:'관리자', staffId:'s1'});
  await setDoc(P(db,'roster','main'), {staff:[{id:'s1',name:'원장'},{id:'s2',name:'직원'}]});
  await setDoc(P(db,'secrets','main'), {pins:{s2:'1234'}});
});

console.log('\n── 병원이 열린 뒤, 직원이 자기 폰으로 처음 로그인 ──');
await ok('직원 폰이 "승인 대기" 요청을 남길 수 있다',
  setDoc(P(새직원(),'claims','newstaff'), {staffId:'s2', name:'직원', phone:'01011112222',
    role:'직원', approved:false, at:1, device:'iPhone'}));
await ok('자기 요청은 자기가 읽을 수 있다', getDoc(P(새직원(),'claims','newstaff')));
await no('승인 전에는 명단을 못 읽는다', getDoc(P(새직원(),'roster','main')));
await ok('관리자가 승인해 준다',
  setDoc(P(원장(),'claims','newstaff'), {staffId:'s2', name:'직원', role:'직원', approved:true, at:2}));
await ok('승인 뒤에는 명단을 읽는다', getDoc(P(새직원(),'roster','main')));

console.log('\n── 관리자(실장) 폰이 새로 들어올 때 ──');
await ok('실장 폰도 요청을 남길 수 있다',
  setDoc(P(env.authenticatedContext('mgr').firestore(),'claims','mgr'),
    {phone:'01033334444', pinHash:'abc', approved:false, at:1, device:'Galaxy'}));
await no('실장 폰이 스스로 관리자가 되지는 못한다',
  setDoc(P(env.authenticatedContext('mgr2').firestore(),'claims','mgr2'),
    {staffId:'s1', role:'관리자', approved:true, at:1}));

console.log(`\n${pass} 통과 / ${fail} 실패`);
await env.cleanup(); process.exit(fail?1:0);
