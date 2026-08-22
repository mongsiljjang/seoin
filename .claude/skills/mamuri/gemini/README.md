# mamuri — Gemini 판

Claude Code 판(`../SKILL.md`)과 **같은 원리, 다른 작동 방식**이다.

> ⚠️ **이 폴더의 파일은 Claude 스킬이 아니다.** `SKILL.md` 가 없어서 Claude 의 스킬
> 업로드 창에 넣으면 "유효하지 않은 스킬" 로 거부된다. Claude 계정에 올릴 것은
> 저장소 루트에서 `scripts/package.sh mamuri` 로 만드는 `dist/mamuri-skill.zip` 이다.

## Gemini 는 자리에 따라 손이 있고 없다

여기가 ChatGPT 판과 갈리는 지점이다. **먼저 어느 자리인지 정하고 시작한다.**

| 자리 | 파일·명령 | 쓸 파일 |
|---|---|---|
| **Gem** (맞춤 Gem) | 없음 — 사용자가 붙여넣는다 | [`INSTRUCTIONS.md`](INSTRUCTIONS.md) |
| **Gemini CLI** | 있음 — 직접 실측한다 | [`GEMINI.md`](GEMINI.md) |

`INSTRUCTIONS.md` 는 손이 없는 경우를 기준으로 쓰였지만, 맨 앞에
**"손이 있으면 직접 돌려라"** 는 갈림길을 넣어 뒀다. CLI 에서도 그대로 읽힌다.

## Gem 만들기

1. Gemini → **Gem 관리자** → **새 Gem**
2. **이름**: `마무리` · **설명**: `세션을 마무리해 다음 세션에 넘긴다`
3. **안내(Instructions)**: [`INSTRUCTIONS.md`](INSTRUCTIONS.md) 를 통째로 붙여넣는다
4. **지식 파일**: 아래 둘을 올린다
   - [`../references/PRINCIPLES.md`](../references/PRINCIPLES.md) — 규칙이 어떤 실패에서 나왔는지
   - [`../references/TEMPLATE.md`](../references/TEMPLATE.md) — 서식과 자주 나오는 실수

**지침 길이 제한은 확인하지 않았다.** 붙여넣었을 때 잘리면
`# 하지 말 것` 아래와 `# 말투` 를 먼저 덜어낸다 — 나머지가 본체다.

## Gemini CLI 에서 쓰기

프로젝트 뿌리의 `GEMINI.md` 에 [`GEMINI.md`](GEMINI.md) 내용을 넣는다.
이미 있으면 이어 붙인다. 스킬 폴더째 가져다 뒀다면 `../SKILL.md` 를 그대로 읽으므로
절차를 두 번 적을 필요가 없다.

```bash
git clone --depth 1 https://github.com/mongsiljjang/skills /tmp/skills
cp -r /tmp/skills/mamuri <프로젝트>/.gemini/
cat /tmp/skills/mamuri/gemini/GEMINI.md >> <프로젝트>/GEMINI.md
chmod +x <프로젝트>/.gemini/mamuri/scripts/repo_snapshot.sh
```

## 쓰는 법

> 오늘 작업 마무리하고 다음 세션에 넘겨줘

**Gem 이면** 상태를 붙여달라고 요청할 것이다.
[`../gpt/PASTE_COMMANDS.md`](../gpt/PASTE_COMMANDS.md) 의 명령을 돌려 결과를 붙여넣는다.
안 붙이면 그 항목은 **"미확인"** 으로 적힌다 — 고장이 아니라 정상이다. 거짓말을 안 하는 것이다.

**CLI 면** 알아서 실측한다. 검증까지 다시 돌리고 실제 숫자를 적는다.

## 여러 판을 같이 쓸 때

같은 프로젝트를 Claude Code · ChatGPT · Gemini 로 오가며 쓴다면
**핸드오프 문서는 한 곳에만** 둔다. 보통 저장소의 `review/` 다.
각자 자기 문서를 만들기 시작하면 다음 세션이 뭘 믿어야 할지 모른다.
