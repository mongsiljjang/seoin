// 제공되는 파스텔톤 컬러 배열
const colors = ['btn-mint', 'btn-pink', 'btn-lavender', 'btn-lemon', 'btn-sky', 'btn-peach'];

// 초기 제공 데이터 (언제든 삭제/추가 가능)
const defaultPins = [
    { title: '블로그 글쓰기', url: 'https://chatgpt.com/', color: 'btn-mint' },
    { title: '마케팅 기획', url: 'https://chatgpt.com/', color: 'btn-pink' },
    { title: '영어 이메일', url: 'https://chatgpt.com/', color: 'btn-lavender' }
];

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

    // 핀 추가 (팝업에서는 prompt()가 작동하지 않아 입력 폼을 쓴다)
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
            showToast('핀 이름과 링크 주소를 모두 채워주세요');
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

    let toastTimer = null;
    function showToast(msg) {
        toast.textContent = msg;
        toast.className = 'show';
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = ''; }, 2200);
    }
});
