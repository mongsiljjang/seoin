"use strict";

/* ---------- 공통: 토스트 알림 ---------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2200);
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (e) {
    // 팝업에서 clipboard 접근 실패 시 textarea 폴백
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    return ok;
  }
}

/* ---------- 탭 전환 ---------- */
function openTab(tabName, btn) {
  document.querySelectorAll(".tabcontent").forEach((c) => (c.style.display = "none"));
  document.querySelectorAll(".tablinks").forEach((b) => b.classList.remove("active"));
  document.getElementById(tabName).style.display = "block";
  btn.classList.add("active");
}
document.querySelectorAll(".tablinks").forEach((btn) => {
  btn.addEventListener("click", () => openTab(btn.dataset.tab, btn));
});

/* ---------- 1. 수노(Suno) ---------- */
function buildSunoPrompt() {
  const genre = document.getElementById("suno-genre").value;
  const topic = (document.getElementById("suno-topic").value || "a quiet moment").trim();
  return `[Intro]
Instrumental, ${genre}

[Verse 1]
Song about ${topic}

[Chorus]
${topic}`;
}
document.getElementById("btn-suno").addEventListener("click", async () => {
  const prompt = buildSunoPrompt();
  const pv = document.getElementById("suno-preview");
  pv.textContent = prompt;
  pv.style.display = "block";
  toast((await copyText(prompt)) ? "수노 프롬프트 복사 완료! 수노 입력창에 붙여넣으세요." : "복사 실패 — 아래 미리보기를 직접 복사하세요.");
});

/* ---------- 2. 미드저니(Midjourney) ---------- */
function buildMjPrompt() {
  const style = document.getElementById("mj-style").value;
  const subject = (document.getElementById("mj-subject").value || "a subject").trim();
  return `/imagine prompt: ${subject}, ${style}`;
}
document.getElementById("btn-mj").addEventListener("click", async () => {
  const prompt = buildMjPrompt();
  const pv = document.getElementById("mj-preview");
  pv.textContent = prompt;
  pv.style.display = "block";
  toast((await copyText(prompt)) ? "미드저니 명령어 복사 완료! 디스코드 창에 붙여넣으세요." : "복사 실패 — 아래 미리보기를 직접 복사하세요.");
});

/* ---------- 3. 유튜브(Youtube) ---------- */
const DEFAULT_TAGS =
  "shorts, viral, trending, 브이로그, 꿀팁, 리뷰, 브금, 무료음악, ai music, midjourney";

const tagsBox = document.getElementById("yt-tags");

// 저장된 태그 불러오기 (없으면 기본값)
chrome.storage.sync.get(["globalTags"], (res) => {
  tagsBox.value = res.globalTags || DEFAULT_TAGS;
});
// 편집 시 자동 저장
tagsBox.addEventListener("input", () => {
  chrome.storage.sync.set({ globalTags: tagsBox.value });
});

function parseTags(raw) {
  return raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

// 태그 복사
document.getElementById("btn-yt-copy").addEventListener("click", async () => {
  const tags = parseTags(tagsBox.value).join(", ");
  toast((await copyText(tags)) ? "태그 복사 완료! 스튜디오 태그 칸에 붙여넣으세요." : "복사 실패");
});

// 스튜디오에 자동입력
document.getElementById("btn-yt-inject").addEventListener("click", async () => {
  const tags = parseTags(tagsBox.value);
  if (tags.length === 0) {
    toast("입력할 태그가 없습니다.");
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.url || !tab.url.startsWith("https://studio.youtube.com/")) {
    toast("YouTube 스튜디오(영상 세부정보) 페이지를 연 뒤 눌러주세요.");
    return;
  }
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: injectTagsIntoStudio,
      args: [tags],
    });
    toast(result && result.ok ? `태그 ${result.added}개 입력 완료!` : (result && result.msg) || "태그 칸을 찾지 못했어요. '자세히 보기'를 펼친 뒤 다시 시도하세요.");
  } catch (e) {
    toast("자동입력 실패 — 태그 복사 후 직접 붙여넣으세요.");
  }
});

/* 스튜디오 페이지 안에서 실행되는 함수 (별도 컨텍스트) */
function injectTagsIntoStudio(tags) {
  // YouTube 스튜디오 태그 입력칸 후보 셀렉터
  const candidates = [
    "#tags-container #text-input",
    "ytcp-form-input-container#tags-container input#text-input",
    "#tags-container input",
    'ytcp-chip-bar input[aria-label]',
  ];
  let input = null;
  for (const sel of candidates) {
    input = document.querySelector(sel);
    if (input) break;
  }
  if (!input) {
    return { ok: false, msg: "태그 칸을 못 찾음. '자세히 보기(SHOW MORE)'를 펼쳐주세요." };
  }
  input.focus();
  let added = 0;
  for (const tag of tags) {
    // 네이티브 setter로 값 주입 (React/Polymer 감지)
    const proto = Object.getPrototypeOf(input);
    const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
    if (setter) setter.call(input, tag);
    else input.value = tag;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    // Enter로 칩 확정
    const enter = { key: "Enter", code: "Enter", keyCode: 13, which: 13, bubbles: true };
    input.dispatchEvent(new KeyboardEvent("keydown", enter));
    input.dispatchEvent(new KeyboardEvent("keyup", enter));
    added++;
  }
  return { ok: true, added };
}

/* 기본 탭 열기 */
document.getElementById("defaultOpen").click();
