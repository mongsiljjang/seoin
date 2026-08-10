/* =============================================================================
   공유 버전 설정 파일 (Firebase)
   -----------------------------------------------------------------------------
   ▶ 이 값들을 채우면 "전 직원이 같은 데이터를 실시간 공유"하는 공유 모드로 켜집니다.
   ▶ 비워두면 앱은 '이 기기 저장' 모드로만 동작합니다 (기존과 동일).
   ▶ 값 넣는 방법은 SETUP-공유버전.md 파일을 그대로 따라 하시면 됩니다.

   ⚠️ 여기 들어가는 apiKey는 "비밀번호"가 아니라 공개돼도 되는 식별값입니다.
      실제 보안은 Firebase 보안규칙 + 링크 비공개로 관리합니다. (가이드 참고)
   ============================================================================= */
window.FIREBASE_CONFIG = {
  apiKey: "AIzaSyASPTmQMiKpUTD4qTATW6UjLf163cq7m7A",
  authDomain: "hospital-d0819.firebaseapp.com",
  projectId: "hospital-d0819",
  storageBucket: "hospital-d0819.firebasestorage.app",
  messagingSenderId: "615146272725",
  appId: "1:615146272725:web:911b238de5cc1bd2a22f5c"
};

// 공유 방(작업공간) 이름 — 병원이 하나면 그대로 두세요.
window.WORKSPACE_ID = "clinic";
