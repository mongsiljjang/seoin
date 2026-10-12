# 컴퓨터를 바꿔도 이어 작업하기 (병원 ↔ 집)

기준은 **GitHub** 다. 이 폴더나 컴퓨터가 아니라 GitHub 에 올라간 것만 다른 컴퓨터에서 보인다.
Z: 공유폴더는 병원 안 네트워크라 집에서는 열리지 않는다 — 집 컴퓨터는 GitHub 에서 받는다.

## 1. 떠나기 전 (매번)

Claude 에게 `마무리하자` 라고 한다. 두 저장소 커밋·푸시와 핸드오프 문서 갱신을 한 번에 한다.
직접 확인하려면 저장소 폴더에서:

```bash
git status -sb
```

`clean` 이고 `ahead` 가 없으면 안전하다. **푸시 안 한 작업은 다른 컴퓨터에서 안 보인다.**

## 2. 새 컴퓨터에서 처음 한 번

Windows 기준. 설치 뒤 터미널을 한 번 닫았다 다시 연다.

```bash
winget install Git.Git OpenJS.NodeJS.LTS GitHub.cli
gh auth login
gh repo clone mongsiljjang/mediops-pilot C:\mediops\pilot
gh repo clone mongsiljjang/seoin C:\mediops\seoin
git -C C:\mediops\seoin checkout claude/mediops-auth-migration-l0iv4w
```

- 경로 `C:\mediops\...` 는 원하는 곳으로 바꿔도 된다
- `gh auth login` 은 브라우저 로그인이다. 비밀번호는 직접 넣는다(정식본은 비공개라 로그인이 필요하다)
- Mac 이면 `winget` 대신 `brew install git node gh`

## 3. 새 컴퓨터에서 매번 시작할 때

```bash
git -C C:\mediops\pilot pull
git -C C:\mediops\seoin pull
```

Claude 를 그 폴더에서 열고, 가장 최근 `review/session-handoff-*.md` 맨 아래 "시작 프롬프트"를 붙여 넣는다.

## 4. 이어지는 것 · 안 이어지는 것

- **이어진다**: 코드, 시험(`test/`), `AGENTS.md`, 핸드오프 문서. 배포는 푸시하면 버셀이 한다. Firebase·버셀 설정은 브라우저로 하니 어느 컴퓨터든 같다
- **안 이어진다**: 대화 내용과 Claude 메모리(컴퓨터마다 따로). 중요한 것은 핸드오프 문서에 적는다

## 5. 함정

- `dubious ownership` 오류가 나는 드라이브(D:·Z: 등)에서는 `git -c safe.directory=<경로> -C <경로> …` 를 쓴다. C: 드라이브는 보통 필요 없다. 전역 설정은 건드리지 않는다
- 두 저장소를 맞출 때 파일 통복사 금지 — `git format-patch` → `git am`
- 백업 브랜치 `claude/hospital-inventory-hr-app-fw7a9g` 는 강제 푸시하지 않는다
- 시험은 설치 없이 `node test/<이름>.mjs` 로 돈다(`AGENTS.md` 참고). Node 20 이상
