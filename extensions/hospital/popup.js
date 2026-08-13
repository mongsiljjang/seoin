const $ = (id) => document.getElementById(id);
const DEFAULTS = { url: "", mode: "tab" };

function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.hidden = false;
  setTimeout(() => (t.hidden = true), 1600);
}

function reflect(cfg) {
  const has = !!cfg.url.trim();
  $("open").disabled = !has;
  $("openWin").disabled = !has;
  $("url").value = cfg.url;
  $("modeWindow").checked = cfg.mode === "window";
  if (has) {
    $("hint").textContent = "✓ 준비됐어요. ‘앱 열기’를 누르면 앱이 열립니다.";
    $("hint").className = "hint ok";
    $("settings").open = false;
  } else {
    $("settings").open = true;
  }
}

async function load() {
  const c = await chrome.storage.local.get(DEFAULTS);
  reflect({ url: (c.url || "").trim(), mode: c.mode || "tab" });
}

$("save").addEventListener("click", async () => {
  const url = $("url").value.trim();
  const mode = $("modeWindow").checked ? "window" : "tab";
  if (url && !/^https?:\/\//i.test(url)) {
    toast("주소는 http:// 또는 https:// 로 시작해야 해요");
    return;
  }
  await chrome.storage.local.set({ url, mode });
  reflect({ url, mode });
  toast("저장했어요");
});

$("open").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_APP" }, () => window.close());
});
$("openWin").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "OPEN_APP", mode: "window" }, () => window.close());
});

load();
