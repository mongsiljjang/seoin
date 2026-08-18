---
name: deslop-ko
description: 한국어 웹페이지·HTML의 "AI 티(슬롭)"를 결정론적으로 검사한다. 한글 조판(word-break:keep-all 누락, 한글 전용 폰트가 스택 맨 앞, 제목 행간 1.25 미만, 굵은 한글 제목의 양수 자간, 글자 분해 애니메이션의 어절 래퍼 부재)과 시각 슬롭(그라디언트 텍스트, 색을 띤 그림자, 40px 이상 과한 번짐, 글래스모피즘 backdrop-filter, 본문 서체가 Inter·Arial·system, WCAG AA 미달 저대비, 국내 플랫폼 브랜드 색 차용)을 함께 본다. LLM·API 키·의존성 없이 실측으로 판정하고, 자동 수정은 하지 않고 보고만 한다(왜·수정·주의 3줄). 트리거 — "이 페이지 AI 티 나?", "한글 조판 검사", "AI 슬롭 검사", "UI 슬롭 체크", "deslop", "웹페이지 디자인 점검", "한글 웹 검사", "landing page AI slop check(Korean)". 한국어 웹 UI·랜딩·아티팩트를 만들거나 고친 뒤 점검할 때 사용. 문서(.md)와 아카이브/실험 파일은 기본 제외.
license: Apache-2.0
---

# deslop-ko — 한국어 웹 AI 슬롭 검사기

한국어 웹의 **한글 조판**과 **시각 슬롭**을 결정론적으로 검사한다. 영어권 도구가 못 보는 한글 조판 문제를 실측으로 잡는다. **아무것도 자동으로 고치지 않는다 — 보고만 하고 결정은 사람이 한다.**

요구 환경: **Node.js ≥ 20** (외부 의존성 없음, 네트워크·API 키 불필요).

## 언제 쓰나
- 한국어 웹페이지·랜딩·아티팩트(HTML/CSS)를 **만들거나 고친 직후 점검**할 때.
- 사용자가 "AI 티 나는지 봐줘 / 한글 조판 검사 / 슬롭 체크 / deslop" 등을 요청할 때.
- CI에서 회귀 검사를 걸 때(`--json`).

## 실행 방법

검사 대상(HTML 파일이 있는 폴더 또는 파일 경로)을 인자로 준다.

```bash
node scripts/scan.mjs <경로>                   # 사람이 읽는 리포트
node scripts/scan.mjs <경로> --json            # 기계용(CI)
node scripts/scan.mjs <경로> --only=ko-word-break   # 특정 규칙만
node scripts/scan.mjs <경로> --skip=ko-line-height  # 특정 규칙 제외
node scripts/scan.mjs <경로> --include-archives      # 아카이브/실험 파일까지 포함
```

- 기본적으로 `steps/`, `v1/`, `bg-samples.html`, `making.html` 같은 **아카이브·실험 파일과 `*.md` 는 제외**한다(노이즈 방지).
- 스캐너가 이 스킬 폴더 안에 있으므로, 스킬 디렉터리에서 위 경로(`scripts/scan.mjs`)로 실행한다.

## 리포트 읽는 법
각 지적은 **왜 · 수정 · 주의** 세 줄이 붙는다. `주의`는 오탐(정상인데 걸린) 조건이니 반드시 함께 읽고, 정상 조판이면 넘긴다. deslop-ko는 "오탐이 정탐보다 비싸다"는 원칙이라, 근거(선택자에 매칭되는 실제 텍스트)가 없으면 판정하지 않는다.

## 사용자에게 보고할 때
1. 스캔을 돌리고, 결과를 **심각도·빈도 순으로 요약**한다(저대비·word-break 누락 등 확실한 것 먼저).
2. 각 항목의 **위치(파일:줄)·왜·수정**을 사람 말로 전달한다.
3. **자동으로 고치지 말고**, 어떤 걸 고칠지 사용자가 정하게 한다. 의도된 예외는 코드에 사유 주석으로 면제한다:
   ```css
   /* deslop-ko-ignore ko-letter-spacing: 워드마크라 의도적으로 벌린 자간 */
   ```

## 규칙 요약
- **한글 조판**: `ko-word-break`, `ko-font-order`, `ko-line-height`, `ko-letter-spacing`, `ko-split-word-break`
- **시각 슬롭(언어 무관)**: `gradient-text`, `glow-shadow`, `oversized-shadow`, `glassmorphism`, `default-font`, `low-contrast`, `borrowed-brand-color`

규칙 세부와 근거는 `README.md`, 귀속은 `NOTICE` 참고. 원저작: mincheol10007, Apache-2.0.
