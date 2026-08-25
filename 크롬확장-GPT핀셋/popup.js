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
