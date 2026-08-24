// 내 도구함 – 백그라운드 서비스워커
// 역할: 콘텐츠 스크립트에서 받은 곡 목록을 오프스크린 문서로 넘겨
//       (fetch → 디코드 → WAV 인코드) 시킨 뒤 chrome.downloads 로 저장한다.

const OFFSCREEN = "offscreen.html";
let creating = null;               // 오프스크린 생성 중복 방지
const downloadToBlob = new Map();  // downloadId -> blobUrl (완료 후 해제)
let activeJobs = 0;
let pending = [];                  // 오프스크린이 준비되기 전 대기 중인 작업

async function ensureOffscreen() {
  if (creating) { await creating; return; }
  creating = chrome.offscreen.createDocument({
    url: OFFSCREEN,
    reasons: ["AUDIO_PLAYBACK"],
    justification: "오디오 파일을 디코딩하여 WAV로 변환합니다.",
  });
  try { await creating; } finally { creating = null; }
}

// 대기 중인 작업들을 오프스크린으로 전달
function flushPending() {
  const jobs = pending;
  pending = [];
  for (const job of jobs) {
    activeJobs++;
    chrome.runtime.sendMessage({
      target: "offscreen",
      type: "CONVERT_BATCH",
      tabId: job.tabId,
      tracks: job.tracks,
      folder: job.folder,
    });
  }
}

async function closeOffscreenIfIdle() {
  if (activeJobs > 0) return;
  if (downloadToBlob.size > 0) return;
  if (await chrome.offscreen.hasDocument?.()) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }
}

// 콘텐츠 스크립트 → 여기
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  // 곡 목록 다운로드 시작
  if (msg.type === "SUNO_DOWNLOAD") {
    const tabId = sender.tab && sender.tab.id;
    startBatch(msg.tracks || [], tabId).then(sendResponse);
    return true;
  }

  // 다운로드 중단
  if (msg.type === "SUNO_CANCEL") {
    pending = [];  // 아직 시작 안 한 작업 버림
    // 진행 중인 다운로드도 취소
    for (const id of downloadToBlob.keys()) { chrome.downloads.cancel(id).catch(() => {}); }
    chrome.runtime.sendMessage({ target: "offscreen", type: "CANCEL" });
    return;
  }

  // 오프스크린 문서가 로드되어 준비됨 → 대기 작업 전달
  if (msg.type === "OFFSCREEN_READY") {
    flushPending();
    return;
  }

  // 오프스크린 → 곡 1개 변환 완료 (WAV blob URL 준비됨)
  if (msg.type === "TRACK_READY") {
    handleTrackReady(msg);
    return;
  }
  // 오프스크린 → 진행/오류 상황을 원래 탭으로 중계
  if (msg.type === "TRACK_PROGRESS" || msg.type === "TRACK_ERROR" || msg.type === "BATCH_DONE") {
    if (msg.tabId != null) chrome.tabs.sendMessage(msg.tabId, msg).catch(() => {});
    if (msg.type === "BATCH_DONE") { activeJobs = Math.max(0, activeJobs - 1); closeOffscreenIfIdle(); }
    return;
  }
});

async function startBatch(tracks, tabId) {
  if (!tracks.length) return { ok: false, reason: "empty" };
  // 저장 폴더는 서비스워커에서 읽어 오프스크린에 넘긴다 (offscreen 은 chrome.storage 접근 불가)
  const { sunoFolder } = await chrome.storage.local.get({ sunoFolder: "Suno" });
  pending.push({ tracks, tabId, folder: sunoFolder });
  const has = await chrome.offscreen.hasDocument?.();
  if (has) {
    flushPending();            // 이미 로드된 오프스크린 → 바로 전달
  } else {
    await ensureOffscreen();   // 새로 생성 → OFFSCREEN_READY 때 flush
  }
  return { ok: true, count: tracks.length };
}

async function handleTrackReady(msg) {
  // msg: { blobUrl, filename, tabId, index, total }
  try {
    const id = await chrome.downloads.download({
      url: msg.blobUrl,
      filename: msg.filename,
      conflictAction: "uniquify",
      saveAs: false,
    });
    downloadToBlob.set(id, msg.blobUrl);
  } catch (e) {
    // 실패 시에도 blob 정리 요청
    chrome.runtime.sendMessage({ target: "offscreen", type: "REVOKE", blobUrl: msg.blobUrl });
    if (msg.tabId != null) {
      chrome.tabs.sendMessage(msg.tabId, {
        type: "TRACK_ERROR", tabId: msg.tabId, index: msg.index,
        error: "저장 실패: " + (e && e.message ? e.message : e),
      }).catch(() => {});
    }
  }
}

// 다운로드가 끝나면 해당 blob URL 해제 → 메모리 정리
chrome.downloads.onChanged.addListener((delta) => {
  if (!delta.state) return;
  const s = delta.state.current;
  if (s === "complete" || s === "interrupted") {
    const blobUrl = downloadToBlob.get(delta.id);
    if (blobUrl) {
      chrome.runtime.sendMessage({ target: "offscreen", type: "REVOKE", blobUrl });
      downloadToBlob.delete(delta.id);
      closeOffscreenIfIdle();
    }
  }
});
