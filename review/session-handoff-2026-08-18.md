# Session Handoff — 2026-08-18 · MediOps

새 세션이 채팅 기록 없이 이어받기 위한 문서. 상세는 코드·커밋·`docs/`가 담고, 여기선 상태와 다음 지점만.

## 1. 세션 목표와 완료 결과
치과 운영 앱(MediOps, 파일럿)을 실사용 가능하게 다듬고, 상용화(SaaS) 방향을 문서화했다. 완료:
- **UI 리디자인**(GPT MediOps 톤): 홈 히어로 "오늘 처리할 일", 재고 대시보드, 임플란트 매트릭스 정리.
- **임플란트 재고 대사**: 매입·사용(일반/보험/페일)·현재고·실재고·오차 + 실사/보정 + 최근30일 사용추이. (`DB.implantLogs` append-only)
- **출퇴근 강제성**: 공용 기기 키오스크(`#kiosk`, 이름+PIN), 미출근 배너(직원/관리자), 삭제 안전장치(관리자 전용+확인, 일괄삭제), **GPS 반경 확인(선택·기본 off)**.
- **연월차**: 입사일 기준 연차 자동 계산(1년차11·2~3년차15·4년차부터16, 2년마다+1, 최대25) + 관리자 수동 override, 이름 탭 편집.
- **문서**: `docs/ROADMAP.md`(상용화 로드맵), `docs/DATA_MODEL.md`(기존).
- **스킬 설치**: `.claude/skills/`에 deslop-ko·wrap(+seoin엔 design-md-styles).

## 2. 결정과 근거
- **Firebase 유지**(Supabase로 안 감): 기존 자산·검증 완료, 이전 리스크 최소화.
- **출근 GPS는 옵션·기본 off**: 대형병원 대비 기능 확보하되 소규모 마찰 회피. 대리출근 완전차단은 하드웨어(지문) 필요 — 소프트는 억제까지만(정직하게 고지).
- **차트번호로 환자 식별**(이름/전화 아님): 가명화, 개인정보 최소화. (사용 기록 연결 — 미구현, 대기)
- **거래처 로그인·문자/카톡 알림 = 서버 필요 → 상용화 Phase 2로 연기**. 현재 정적 앱은 서버 없음(인앱 알림만).
- **개발 경로**: 로컬 불가 사용자 → claude.ai/code(현재 방식) 유지 권장. 코드=GitHub, 데이터=Firebase 소유로 락인 방지.

## 3. 산출물 (durable)
- 앱: `index.html` (양 저장소 동일). 배포: https://mongsiljjang.github.io/mediops-pilot/
- 로드맵 문서: `docs/ROADMAP.md` + 공유용 아티팩트: https://claude.ai/code/artifact/e272742c-7c62-40c6-8063-adf8fd22c221
- 사용자에게 전달(저장소 미포함, 채팅 첨부): `deslop-ko.skill`·`wrap.skill` zip, `gpt-skills-8.zip`(스킬8종 GPT 변환), `gpt-builder/INSTRUCTIONS.md`(오리지널). ※ 제3자 스킬 원본은 라이선스상 저장소에 커밋하지 않음.

## 4. 검증 (실행 결과)
Playwright 스모크 6종 통과: 재고/임플란트 렌더, 키오스크+PIN(정오답)+미출근 배너, GPS 게이트(반경 내/외/관리자 우회/off), 연차 계산·수동override, 임플란트 대사(매입15·사용6·현재고→실사7·오차보정). Firebase 실시간 동기화는 목(mock) 2-디바이스로 검증(A↔B 반영). deslop-ko로 로드맵 페이지 자체 점검(저대비·word-break·font-order 지적 확인 — 미수정, 아래 5).

## 5. 저장소·배포 상태
- `mongsiljjang/mediops-pilot` @ `main` = `db0c2e6` (clean, pushed). GitHub Pages 배포 중.
- `mongsiljjang/seoin` @ `claude/hospital-inventory-hr-app-fw7a9g` = `951eef8` (clean, pushed). 개인 백업.
- 두 저장소 `index.html` 내용 동일 유지가 관례.

## 6. 열린 질문 · 리스크 · 미룬 일
- **거래처(vendor) 역할**: 정적 앱에선 "화면 가림"만 가능(진짜 격리 아님) → 멀티테넌트+서버 필요. 미구현.
- **알림 채널**(문자/카톡 알림톡/메일): 서버+유료 → Phase 2.
- **차트번호 입력칸**(임플란트 사용): 설계 합의됨, 범위(A 임플란트만 / B 일반재고 포함) 미확정 → 구현 대기.
- **로드맵 아티팩트 슬롭 수정**: deslop-ko 지적(칩 저대비 2.1:1, `word-break:keep-all` 누락, 한글폰트 스택순서) 미반영.
- **페일 분기교환·벤더 정산(할당률·이월)**: 규칙 미확정.
- 노무(사직서·급여명세서·근로계약서)·세무 자료 모듈: Phase 4~5.

## 7. 다음 작업 (우선순위)
1. **차트번호 입력칸** 임플란트 사용 모달에 추가(선택·차트번호만, 이력에 표시) — 범위 A/B 사용자 확인 후.
2. **로드맵 아티팩트 접근성 수정**(deslop-ko 지적 반영) — 원하면.
3. **거래처 역할 + 품목별 알림 임계치**(무료 범위: 관리자용 거래처별 보기 + 인앱 알림) vs Phase2 설계 — 사용자 선택 대기.
4. 상용화 착수 시 **Phase 1 멀티테넌트**(hospitalId 격리 + 보안규칙 + 병원 가입) 먼저.

## 8. 다음 세션 추천 스킬 (설치되어 사용 가능)
- `deslop-ko` — 페이지·아티팩트 만들면 한글 AI-티 점검(코드 실행 시 `node .claude/skills/deslop-ko/scripts/scan.mjs <경로>`).
- `design-md-styles`(seoin) — UI 브랜드 톤 참고.
- `wrap` — 세션 마무리.

## 9. 다음 세션 시작 프롬프트 (복사용)
```
MediOps 치과 앱 이어서 작업. 저장소 mongsiljjang/mediops-pilot(main)·seoin(claude/hospital-inventory-hr-app-fw7a9g), index.html 동일 유지. 배포 https://mongsiljjang.github.io/mediops-pilot/ .
직전 핸드오프: review/session-handoff-2026-08-18.md 읽고 시작.
다음 후보: (1) 임플란트 '사용' 모달에 차트번호 선택입력 추가 — 범위 A(임플란트만)/B(일반재고 포함) 먼저 확인. (2) 로드맵 아티팩트 접근성 수정(deslop-ko 지적). (3) 거래처 역할·품목별 알림.
원칙: Firebase 유지, 개인정보 최소(차트번호만·환자정보 X), 커밋+두 저장소 푸시, 만든 화면은 deslop-ko로 점검.
```
