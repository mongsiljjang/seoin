/* DB 접촉면 시험 — Firebase 를 부르는 코드가 정해 둔 함수 밖으로 퍼지지 않는지 본다.

   왜: 나중에 다른 클라우드·DB 로 옮길 때 비용은 "Firebase 를 부르는 곳이 몇 군데인가"에 비례한다.
   새 함수에서 fdb · firebase. · .collection( · onSnapshot · wsRef()/ref…() 를 쓰면 여기서 실패한다.
   정말 필요해서 더한 것이면 아래 ALLOWED 목록과 docs/DB_MIGRATION.md 3장을 같이 고친다.
   또 Firestore 전용 값(serverTimestamp·FieldValue·트랜잭션·배치)을 쓰지 않는지(이식되는 모양) 본다.
   돌리는 법:  node test/DB접촉면.mjs        (설치 필요 없음) */
import fs from 'fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const doc = fs.readFileSync(new URL('../docs/DB_MIGRATION.md', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');

const ALLOWED = [
  // 경로 만들기
  'wsRef','refShared','refRoster','refSecrets','refPeople','refMeta','refUsage','refOwnerKey','refUnlock','refClaims','refLicense','refOpslog','refResignInv','refResignSub',
  // 연결·구독
  'cloudInit','watchClaim','watchRecovery','watchLicense','watchPendingClaims','loadGateMeta',
  // 읽기·쓰기
  'writeAll','cloudPushNow','cloudPush','migrateIfNeeded','openData',
  // 기기 승인
  'claimDevice','cancelClaim','approveClaim','rejectClaim','renderActiveClaims','applyRole',
  // 로그인·개설
  'doLogin','doOwnerLogin','doRecoveryLogin','doSetupAdmin','explainSetupFail','sendOpenRequest','setOwnerKey',
  // 사직서 링크
  'openResignLink','makeResignLink','acceptResignSub','openStaffHub',
  // 사진 판독(로그인 토큰)
  'scanCall'
];

const re = /\bfdb\b|\bfirebase\.|\.collection\(|\bonSnapshot\b|\bwsRef\(\)|\bref[A-Z][A-Za-z]*\(\)/;
const funcRe = /^(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(/;
const found = new Set(); let cur = '(최상위)';
js.split('\n').forEach(ln => {
  const m = funcRe.exec(ln);
  if (m) cur = m[1]; else if (/^(?:let|const|var)\s/.test(ln)) cur = '(최상위)';
  if (re.test(ln) && !/^\s*(\/\/|\*|\/\*)/.test(ln) && cur !== '(최상위)') found.add(cur);
});

let pass=0, fail=0;
const t=(이름, 참, 힌트)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름+(힌트?'\n      '+힌트:''));} };

const extra=[...found].filter(f=>!ALLOWED.includes(f)), gone=ALLOWED.filter(f=>!found.has(f));
t(`Firebase 를 부르는 함수는 정해 둔 ${ALLOWED.length}개뿐이다`, extra.length===0,
  extra.length? `목록에 없는 함수가 Firebase 를 부른다: ${extra.join(', ')} — 접촉면을 늘리면 이전 비용이 커진다. 꼭 필요하면 이 시험의 ALLOWED 와 docs/DB_MIGRATION.md 3장을 같이 고친다.` : '');
t('목록의 함수가 모두 실제로 Firebase 를 부른다(사라진 것은 목록에서도 뺀다)', gone.length===0, gone.length? `이제 Firebase 를 안 부르는 함수: ${gone.join(', ')} — ALLOWED 와 문서에서 빼 준다.` : '');
t('문서(docs/DB_MIGRATION.md)에 접촉면 함수가 모두 적혀 있다', ALLOWED.every(f=>doc.includes('`'+f+'`')), '문서 3장에 없는 함수: '+ALLOWED.filter(f=>!doc.includes('`'+f+'`')).join(', '));
t('Firestore 전용 값을 쓰지 않는다(serverTimestamp·FieldValue·트랜잭션·배치) — 어느 DB 로든 옮길 수 있는 모양', !/serverTimestamp|FieldValue|runTransaction|\.batch\(\)/.test(js));
t('문서 경로는 hospapp/{병원}/{종류}/{문서} 한 단계다(서브컬렉션 질의·collectionGroup 을 쓰지 않는다)', !/collectionGroup/.test(js) && (js.match(/\.collection\(/g)||[]).length>0);
t('앱 상태 전체가 하나의 JSON(DB)으로 백업·복원된다(이전 때 옮길 형태)', js.includes('function backupSummary(d)') && js.includes('lastBackupAt'));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
