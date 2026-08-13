// 병원 관리 앱 런처 - 백그라운드 서비스워커
// 저장된 앱 주소를 탭 또는 앱 창으로 엽니다.

const DEFAULTS = { url: "", mode: "tab" };

async function getConfig() {
  const c = await chrome.storage.local.get(DEFAULTS);
  return { url: (c.url || "").trim(), mode: c.mode || "tab" };
}

async function openApp(overrideMode) {
  const { url, mode } = await getConfig();
  if (!url) {
    // 주소가 없으면 설정(팝업)을 열도록 유도
    await chrome.action.openPopup().catch(() => {});
    return { ok: false, reason: "no-url" };
  }
  const useMode = overrideMode || mode;
  if (useMode === "window") {
    await chrome.windows.create({ url, type: "popup", width: 460, height: 900 });
  } else {
    await chrome.tabs.create({ url });
  }
  return { ok: true };
}

// 단축키(Ctrl+Shift+H)
chrome.commands.onCommand.addListener((command) => {
  if (command === "open-app") openApp();
});

// 팝업에서 오는 메시지 처리
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg && msg.type === "OPEN_APP") {
    openApp(msg.mode).then(sendResponse);
    return true; // 비동기 응답
  }
});
