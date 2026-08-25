// ─────────────────────────────────────────────
// 1) 무한대 컬러 고정핀
// ─────────────────────────────────────────────
const colors = ['btn-mint', 'btn-pink', 'btn-lavender', 'btn-lemon', 'btn-sky', 'btn-peach'];

const defaultPins = [
    { title: '블로그 글쓰기', url: 'https://chatgpt.com/', color: 'btn-mint' },
    { title: '마케팅 기획', url: 'https://chatgpt.com/', color: 'btn-pink' },
    { title: '영어 이메일', url: 'https://chatgpt.com/', color: 'btn-lavender' }
];

// ─────────────────────────────────────────────
// 2) 변환 복사기에 숨겨둔 프롬프트 3종
//    (버튼을 누르면 원본 글 아래에 자동으로 붙어 복사된다)
// ─────────────────────────────────────────────
const TONE_PROMPTS = {
    emotion: `위의 글을 다음 절대 규칙에 따라 '사람의 언어'로 해체하고 다시 써줘. 너는 10년 차 실전 마케터다.
1. '혁신적인', '뛰어난', '종합적인', '요약하자면' 같은 영혼 없는 AI식 표현은 완전히 삭제할 것.
2. 첫 문장은 반드시 원본 내용과 관련된 나의 솔직한 실패 경험이나 의구심을 담은 1인칭 시점으로 시작할 것. (예: 솔직히 처음엔 반신반의했습니다.)
3. 문장 길이를 철저히 비대칭으로 섞을 것. 10자 이내의 짧은 단문 2개 뒤에 50자 이상의 긴 문장 1개를 배치할 것.
4. '그리고, 그래서, 하지만' 같은 접속사 사용을 80% 이상 줄일 것.`,

    trust: `위의 글을 다음 절대 규칙에 따라 전문가 칼럼 톤으로 다시 써줘.
1. 감성적 묘사와 감탄사는 배제하고, 구체적인 통계 수치와 단호한 어조를 사용할 것.
2. '혁신적인', '뛰어난' 같은 모호한 형용사 대신 검증 가능한 근거와 숫자로 말할 것.
3. 서론 없이 결론부터 두괄식으로 쓸 것.
4. 문장 길이는 비대칭으로 섞되, 가벼운 유행어나 구어체는 쓰지 말 것.`,

    geo: `위의 글을 AI 검색(GEO·AEO)에 최적화된 구조로 다시 써줘.
1. 인사말과 서론은 모두 빼고, 소제목(H2)은 질문형으로 만들고 그 바로 아래 첫 줄에 40~50단어 이내의 명확한 정답을 두괄식으로 배치할 것.
2. 메인 키워드를 반복하지 말고 관련 전문 유의어를 골고루 섞을 것.
3. 본문 중간에 반드시 3가지 불릿 포인트나 요약 표(Table)를 하나 이상 넣어 마크다운으로 구조화할 것.
4. 형용사 대신 구체적인 수치와 통계를 넣을 것.`
};

// ─────────────────────────────────────────────
// 3) 대표키워드 → 네이버 글 작성 명령서 조립
//    (네이버 C-Rank·D.I.A.+·스마트블록 규칙을 프롬프트에 박아둔다)
// ─────────────────────────────────────────────
function buildNaverPrompt(keyword, experience) {
    const expLine = experience
        ? `- 글에 반영할 나의 실제 경험 메모: "${experience}". 이 메모를 첫 문단과 본문에 자연스럽게 녹일 것. 메모에 없는 경험이나 수치를 지어내지 말 것.`
        : `- 나의 경험 메모는 없다. 경험이 들어가야 할 자리는 문장을 지어내지 말고 [여기에 본인 경험 한 줄] 표시로 비워둘 것.`;

    return `너는 네이버 블로그 상위노출 글을 써 온 10년 차 실전 마케터다. 대표키워드 「${keyword}」로 네이버 블로그 글 한 편을 아래 규칙대로 작성해 줘.

[제목]
- 제목 후보 5개를 먼저 제시할 것. 대표키워드는 제목 앞쪽에 배치.
- 5개 중 3개는 대상·상황을 좁힌 세부 키워드 조합(예: 50대, 초보, 무료)으로 만들 것.

[본문 구조 — 순서대로]
1. 첫 문단: 1인칭 경험 한 줄로 시작하고, 이어서 이 글에서 얻어갈 것을 2~3문장 두괄식으로 요약할 것. 인사말·날씨 얘기 금지.
2. 질문형 소제목 3~4개. 각 소제목 바로 아래 첫 줄에 완결된 정답을 먼저 쓰고, 그다음 부연할 것.
3. 본문 중간에 표(Table) 또는 3가지 불릿 정리를 1개 이상 넣을 것.
4. 글의 하단부는 구체적인 이야기·관찰·시행착오 중심으로 쓸 것.
5. 사진을 넣을 자리를 (사진: 어떤 장면을 찍을지 설명) 형식으로 3곳 이상 표시할 것.
6. 글 끝에 독자가 물어볼 만한 질문과 답(FAQ) 2~3개, 해시태그 5개.

[문체·키워드 규칙]
- 대표키워드는 제목·첫 문단·소제목 중 1곳, 총 3번 안팎만 쓰고 반복하지 말 것. 대신 관련 유의어와 전문 용어를 골고루 쓸 것.
- '혁신적인', '뛰어난', '요약하자면' 같은 AI식 표현 금지. 접속사(그리고·그래서·하지만)는 최소화.
- 문장 길이를 비대칭으로 섞을 것(짧은 단문 2개 뒤에 긴 문장 1개).
- 확실하지 않은 사실·수치는 쓰지 말고 [확인 필요]로 표시할 것.
${expLine}

전체 분량은 공백 포함 1,500자 이상.`;
}

document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('pinContainer');
    const addForm = document.getElementById('addForm');
    const titleInput = document.getElementById('titleInput');
    const urlInput = document.getElementById('urlInput');
    const toast = document.getElementById('toast');

    chrome.storage.local.get(['myPins'], (result) => {
        renderPins(result.myPins || defaultPins);
    });

    function savePins(pins) {
        chrome.storage.local.set({ myPins: pins }, () => renderPins(pins));
    }

    function renderPins(pins) {
        container.innerHTML = '';
        pins.forEach((pin, i) => {
            const wrap = document.createElement('div');
            wrap.className = 'pin-wrap';

            const btn = document.createElement('button');
            btn.className = 'pin-btn ' + pin.color;
            btn.textContent = pin.title;
            btn.onclick = () => chrome.tabs.create({ url: pin.url });

            // 팝업에서는 confirm() 창이 뜨지 않으므로, ✕를 두 번 눌러야 지워지게 한다
            const del = document.createElement('button');
            del.className = 'del-btn';
            del.textContent = '✕';
            del.title = '핀 삭제';
            del.onclick = (e) => {
                e.stopPropagation();
                if (del.classList.contains('confirm')) {
                    pins.splice(i, 1);
                    savePins(pins);
                } else {
                    del.classList.add('confirm');
                    del.textContent = '삭제?';
                    setTimeout(() => {
                        del.classList.remove('confirm');
                        del.textContent = '✕';
                    }, 2500);
                }
            };

            wrap.appendChild(btn);
            wrap.appendChild(del);
            container.appendChild(wrap);
        });
    }

    // ── 핀 추가 (팝업에서는 prompt()가 작동하지 않아 입력 폼을 쓴다) ──
    document.getElementById('addBtn').onclick = () => {
        addForm.classList.add('open');
        titleInput.focus();
    };
    document.getElementById('cancelBtn').onclick = () => {
        addForm.classList.remove('open');
    };
    document.getElementById('saveBtn').onclick = () => {
        const title = titleInput.value.trim();
        const url = urlInput.value.trim();
        if (!title || !url) {
            showToast('핀 이름과 링크 주소를 모두 채워주세요', true);
            return;
        }
        chrome.storage.local.get(['myPins'], (result) => {
            const pins = result.myPins || defaultPins.slice();
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            pins.push({ title, url, color: randomColor });
            savePins(pins);
            titleInput.value = '';
            urlInput.value = 'https://chatgpt.com/';
            addForm.classList.remove('open');
        });
    };

    // ── 네이버 글 생성기: 키워드로 작성 명령서를 조립해 클립보드로 ──
    document.getElementById('naverBtn').onclick = () => {
        const keyword = document.getElementById('kwInput').value.trim();
        const experience = document.getElementById('expInput').value.trim();
        if (!keyword) {
            showToast('대표키워드를 먼저 입력하세요', true);
            return;
        }
        navigator.clipboard.writeText(buildNaverPrompt(keyword, experience)).then(
            () => showToast('명령서 복사 완료! 챗GPT 창에 붙여넣기(Ctrl+V) 후 엔터를 치세요'),
            () => showToast('복사에 실패했습니다. 다시 눌러주세요', true)
        );
    };

    // ── 변환 복사기: 원본 글 + 숨겨진 프롬프트를 묶어 클립보드로 ──
    document.querySelectorAll('.tone-btn').forEach((btn) => {
        btn.onclick = () => {
            const src = document.getElementById('srcText').value.trim();
            if (!src) {
                showToast('먼저 변환할 글을 위 칸에 붙여넣으세요', true);
                return;
            }
            const combined = src + '\n\n---\n' + TONE_PROMPTS[btn.dataset.tone];
            navigator.clipboard.writeText(combined).then(
                () => showToast('복사 완료! 챗GPT 창에 붙여넣기(Ctrl+V) 후 엔터를 치세요'),
                () => showToast('복사에 실패했습니다. 다시 눌러주세요', true)
            );
        };
    });

    let toastTimer = null;
    function showToast(msg, isError) {
        toast.textContent = msg;
        toast.className = 'show' + (isError ? ' err' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = ''; }, 2200);
    }
});
