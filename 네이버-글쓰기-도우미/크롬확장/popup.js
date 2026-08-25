// ═══════════════════════════════════════════════
//  주제 프리셋 — 관점(persona)과 법·표현 가드레일(guard)
//  ※ 웹페이지 버전(../index.html)과 내용이 같아야 한다. 수정하면 양쪽 다 고칠 것.
// ═══════════════════════════════════════════════
const PRESETS = {
    hospital: {
        name: '병원 블로그 (의료광고법 지킴)',
        note: '⚖️ 의료광고법 금지 표현(완치·전후사진·치료경험담 등)이 명령서에 자동 포함됩니다.',
        persona: '이 글은 병원(의원) 공식 블로그의 정보성 글이다. 지역명과 진료과목을 조합한 키워드로 잠재 환자가 검색해 들어온다. 광고 티를 빼고, 환자가 병원에 오기 전 궁금해하는 것을 친절하게 알려주는 글로 쓴다.',
        guard: `- 치료 효과를 보장·단정하는 표현 금지: "완치", "100%", "부작용 없음", "최고", "유일", "안전성이 입증된" 등.
- 환자의 치료 경험담·후기 형식으로 쓰지 말 것 (의료광고법상 치료경험담 광고 금지).
- 치료 전후 비교(비포·애프터) 서술 금지.
- 다른 병원과의 비교·비방 금지.
- 가격·할인·이벤트 언급 금지.
- 증상·치료를 단정하지 말고 "증상과 상태에 따라 다르므로 정확한 진단은 의료진 상담이 필요합니다"를 글 안에 명시할 것.
- 의학적 수치·연구 결과는 확실한 것만 쓰고, 불확실하면 [확인 필요]로 표시할 것.`
    },
    branding: {
        name: '전문가 브랜딩 (내 이름 블로그)',
        note: '병원 현장 경력을 신뢰 자산으로 쓰는 개인 브랜딩 글입니다. 특정 병원 홍보는 하지 않습니다.',
        persona: '이 글은 병원 현장에서 오래 일한 전문가의 개인 블로그 글이다. 목적은 병원 홍보가 아니라, 현장 경험에서 나온 노하우와 관찰을 나눠 강의·자문으로 이어지는 신뢰를 쌓는 것이다. 경력은 구체적으로("병원 현장 30년" 등), 자랑이 아니라 근거로 쓴다.',
        guard: `- 특정 병원의 홍보나 내원 유도 문구를 넣지 말 것 (개인 브랜딩 글이다).
- 의학적 판단을 단정하지 말고 일반 정보와 현장 관찰의 선을 지킬 것.
- 경험은 구체적인 장면으로 쓰되, 환자를 특정할 수 있는 정보는 절대 쓰지 말 것.`
    },
    insurance: {
        name: '기업보험·경영 (보험업법 지킴)',
        note: '⚖️ 주제는 자유롭게(위험관리·복지·정부지원 등), 글이 보험을 다룰 때만 보험업법 규칙이 적용되도록 명령서에 자동 포함됩니다.',
        persona: '이 글은 기업보험 전문가가 쓰는 정보성 글이다. 보험 상품만이 아니라 사업주에게 도움이 되는 주제(위험관리, 직원 복지, 정부 지원 제도, 노무·세무 상식, 병원·사업장 운영 등)를 폭넓게 다룬다. 어떤 주제든 "사업주의 위험과 비용을 줄인다"는 관점으로 자연스럽게 연결해, 전문가에 대한 신뢰가 쌓이고 상담 문의로 이어지게 한다.',
        guard: `- 아래 보험 관련 규칙은 글이 보험을 다루는 경우에 적용할 것. 보험을 다루지 않는 글에는 해당 규칙을 억지로 끼워 넣지 말 것.
- 보장을 단정하는 표현 금지: "무조건 보장", "전액 지급", "손해 볼 일 없는" 등.
- 타사 상품에 대한 비방이나 단순 비교 금지.
- 확정되지 않은 보험금·환급률·수익률 수치를 제시하지 말 것.
- 특정 상품 권유가 아니라 제도·개념 설명 중심으로 쓸 것.
- 보험 상품을 다룬 글의 끝에는 "보장 내용은 상품과 약관에 따라 다르므로, 가입 전 상품설명서와 약관을 반드시 확인하세요" 안내 문구를 넣을 것.`
    },
    general: {
        name: '범용 (주제 무관)',
        note: '어떤 주제든 쓸 수 있는 기본형입니다. 실습용으로도 좋습니다.',
        persona: '이 글은 해당 분야를 잘 아는 사람이 독자의 눈높이에 맞춰 쓰는 정보성 블로그 글이다.',
        guard: ''
    }
};

const TONE_PROMPTS = {
    emotion: `위의 글을 다음 절대 규칙에 따라 '사람의 언어'로 해체하고 다시 써줘. 너는 10년 차 실전 마케터다.
1. '혁신적인', '뛰어난', '종합적인', '요약하자면' 같은 영혼 없는 AI식 표현은 완전히 삭제할 것.
2. 첫 문장은 반드시 원본 내용과 관련된 나의 솔직한 경험이나 의구심을 담은 1인칭 시점으로 시작할 것.
3. 문장 길이를 철저히 비대칭으로 섞을 것. 10자 이내의 짧은 단문 2개 뒤에 50자 이상의 긴 문장 1개를 배치할 것.
4. '그리고, 그래서, 하지만' 같은 접속사 사용을 80% 이상 줄일 것.
5. 원본에 있던 사실·수치·법적 안내 문구는 하나도 빼거나 바꾸지 말 것.`,
    trust: `위의 글을 다음 절대 규칙에 따라 전문가 칼럼 톤으로 다시 써줘.
1. 감성적 묘사와 감탄사는 배제하고, 구체적인 근거와 단호한 어조를 사용할 것.
2. 모호한 형용사 대신 검증 가능한 사실과 숫자로 말할 것. 불확실하면 [확인 필요]로 표시.
3. 서론 없이 결론부터 두괄식으로 쓸 것.
4. 문장 길이는 비대칭으로 섞되, 가벼운 유행어나 구어체는 쓰지 말 것.
5. 원본에 있던 법적 안내 문구는 그대로 유지할 것.`,
    geo: `위의 글을 AI 검색(GEO·AEO)에 최적화된 구조로 다시 써줘.
1. 인사말과 서론은 모두 빼고, 소제목은 질문형으로 만들고 그 바로 아래 첫 줄에 40~50단어 이내의 명확한 정답을 두괄식으로 배치할 것.
2. 메인 키워드를 반복하지 말고 관련 전문 유의어를 골고루 섞을 것.
3. 본문 중간에 반드시 3가지 불릿 포인트나 요약 표(Table)를 하나 이상 넣어 구조화할 것.
4. 원본에 있던 사실·수치·법적 안내 문구는 하나도 빼거나 바꾸지 말 것.`
};

function buildPrompt(preset, keyword, experience) {
    const expLine = experience
        ? `- 글에 반영할 나의 실제 경험 메모: "${experience}". 이 메모를 첫 문단과 본문에 자연스럽게 녹일 것. 메모에 없는 경험이나 수치를 지어내지 말 것.`
        : `- 나의 경험 메모는 없다. 경험이 들어가야 할 자리는 문장을 지어내지 말고 [여기에 본인 경험 한 줄] 표시로 비워둘 것.`;
    const guardBlock = preset.guard
        ? `\n[반드시 지킬 법·표현 규칙 — 하나라도 어기면 글 전체를 다시 쓸 것]\n${preset.guard}\n`
        : '';

    return `너는 네이버 블로그 상위노출 글을 써 온 10년 차 실전 마케터다. 대표키워드 「${keyword}」로 네이버 블로그 글 한 편을 아래 규칙대로 작성해 줘.

[글의 관점]
${preset.persona}
${guardBlock}
[제목]
- 제목 후보 5개를 먼저 제시할 것. 대표키워드는 제목 앞쪽에 배치.
- 5개 중 3개는 대상·상황·지역을 좁힌 세부 키워드 조합으로 만들 것.

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

// ═══════════════════════════════════════════════
//  저장(chrome.storage) · 화면 로직
// ═══════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
    const presetSelect = document.getElementById('presetSelect');
    const guardNote = document.getElementById('guardNote');
    const customForm = document.getElementById('customForm');
    const customDelete = document.getElementById('customDelete');
    const kwInput = document.getElementById('kwInput');
    const expInput = document.getElementById('expInput');
    const srcText = document.getElementById('srcText');
    const toast = document.getElementById('toast');

    let customPresets = {};

    function save(key, value) {
        chrome.storage.local.set({ ['nv_' + key]: value });
    }

    function allPresets() { return Object.assign({}, PRESETS, customPresets); }

    function renderPresetOptions(selectedId) {
        presetSelect.innerHTML = '';
        Object.entries(allPresets()).forEach(([id, p]) => {
            const opt = document.createElement('option');
            opt.value = id; opt.textContent = p.name;
            presetSelect.appendChild(opt);
        });
        presetSelect.value = allPresets()[selectedId] ? selectedId : 'hospital';
        updatePresetInfo();
    }

    function updatePresetInfo() {
        const p = allPresets()[presetSelect.value];
        guardNote.textContent = p.note || '내가 직접 등록한 업종입니다. 규칙은 등록할 때 적은 내용이 들어갑니다.';
        customDelete.classList.toggle('show', !!customPresets[presetSelect.value]);
        save('preset', presetSelect.value);
    }

    // 이전에 쓰던 내용 복원 (팝업은 닫히면 내용이 날아가므로 저장해 둔다)
    chrome.storage.local.get(
        ['nv_keyword', 'nv_exp', 'nv_draft', 'nv_preset', 'nv_custom_presets'],
        (r) => {
            kwInput.value = r.nv_keyword || '';
            expInput.value = r.nv_exp || '';
            srcText.value = r.nv_draft || '';
            customPresets = r.nv_custom_presets || {};
            renderPresetOptions(r.nv_preset || 'hospital');
        }
    );

    kwInput.oninput = () => save('keyword', kwInput.value);
    expInput.oninput = () => save('exp', expInput.value);
    srcText.oninput = () => save('draft', srcText.value);
    presetSelect.onchange = updatePresetInfo;

    // 내 업종 추가·삭제
    document.getElementById('customToggle').onclick = () => customForm.classList.toggle('open');
    document.getElementById('customCancel').onclick = () => customForm.classList.remove('open');
    document.getElementById('customSave').onclick = () => {
        const name = document.getElementById('customName').value.trim();
        const rules = document.getElementById('customRules').value.trim();
        if (!name || !rules) { showToast('업종 이름과 규칙을 모두 채워주세요', true); return; }
        const id = 'custom_' + Date.now();
        customPresets[id] = { name: name + ' (내 업종)', note: '', persona: rules, guard: '' };
        save('custom_presets', customPresets);
        document.getElementById('customName').value = '';
        document.getElementById('customRules').value = '';
        customForm.classList.remove('open');
        renderPresetOptions(id);
        showToast('내 업종이 추가되었습니다');
    };
    customDelete.onclick = () => {
        delete customPresets[presetSelect.value];
        save('custom_presets', customPresets);
        renderPresetOptions('hospital');
        showToast('삭제했습니다');
    };

    // 1단계 — 명령서 복사
    document.getElementById('makeBtn').onclick = () => {
        const keyword = kwInput.value.trim();
        if (!keyword) { showToast('대표키워드를 먼저 입력하세요', true); return; }
        copy(buildPrompt(allPresets()[presetSelect.value], keyword, expInput.value.trim()),
            '명령서 복사 완료! 제미나이·챗GPT 창에 붙여넣기(Ctrl+V) 후 엔터를 치세요');
    };

    // 2단계 — 톤 변환
    document.querySelectorAll('.tone-btn').forEach((btn) => {
        btn.onclick = () => {
            const src = srcText.value.trim();
            if (!src) { showToast('먼저 AI 초안을 2단계 칸에 붙여넣으세요', true); return; }
            copy(src + '\n\n---\n' + TONE_PROMPTS[btn.dataset.tone],
                '복사 완료! 제미나이·챗GPT 창에 붙여넣기(Ctrl+V) 후 엔터를 치세요');
        };
    });

    function copy(text, okMsg) {
        navigator.clipboard.writeText(text).then(
            () => showToast(okMsg),
            () => showToast('복사에 실패했습니다. 다시 눌러주세요', true)
        );
    }

    let toastTimer = null;
    function showToast(msg, isError) {
        toast.textContent = msg;
        toast.className = 'show' + (isError ? ' err' : '');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.className = ''; }, 2600);
    }
});
