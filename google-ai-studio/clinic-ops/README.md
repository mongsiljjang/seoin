# 진료실 병원 운영관리 — Google AI Studio / Firebase용

현재 화면을 Google AI Studio에서 수정하고 Firebase Hosting으로 배포할 수 있도록 Vite + React 구조로 분리한 폴더입니다.

## 로컬 실행

```bash
npm install
cp .env.example .env
npm run dev
```

## Firebase Hosting 배포

```bash
npm run build
firebase login
firebase use --add
firebase deploy --only hosting
```

Firestore를 사용할 때는 먼저 Firebase Authentication과 병원별 역할 권한을 구현하고 `firestore.rules`의 deny-all 규칙을 교체해야 합니다. 관리자 SDK 비밀키나 서비스 계정 JSON은 브라우저 코드와 GitHub에 절대 올리지 마세요.

## Google AI Studio로 이동

GitHub 저장소를 가져온 뒤 이 폴더를 앱 루트로 사용합니다. AI Studio가 저장소의 하위 폴더를 앱 루트로 선택하지 못하면, 이 폴더만 별도 저장소로 분리해 가져오세요.

현재 재고 데이터와 입출고 처리는 화면 상태에만 저장되는 데모입니다. 새로고침하면 초기화되며, 실제 운영 전 Firestore 연동·로그인·감사 로그·백업 정책이 필요합니다.
