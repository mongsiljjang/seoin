// Suno 페이지에 곡 선택 · 일괄 WAV 저장 패널을 띄운다.
// 감지는 최선을 다하되(페이지 구조가 바뀌면 셀렉터 갱신 필요), 실제 변환/저장
// 파이프라인(fetch→디코드→WAV→다운로드)은 백그라운드/오프스크린이 담당한다.
(() => {
  if (window.__sunoToolboxLoaded) return;
  window.__sunoToolboxLoaded = true;

  const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
  const AUDIO_URL = /https?:\/\/[^\s"'\\]+?\/([0-9a-f-]{16,})\.(mp3|wav|m4a|ogg)/gi;

  // ---------- 곡 수집 ----------
  function collectTracks() {
    const map = new Map(); // id -> {id, title, url}

    // 1) /song/{uuid} 링크에서 id + 제목
    document.querySelectorAll('a[href*="/song/"]').forEach((a) => {
      const m = (a.getAttribute("href") || "").match(/\/song\/([0-9a-f-]{16,})/i);
      if (!m) return;
      const id = m[1].toLowerCase();
      const title =
        (a.getAttribute("title") || a.getAttribute("aria-label") || a.textContent || "").trim();
      const cur = map.get(id) || { id, title: "", url: null };
      if (title && (!cur.title || title.length > cur.title.length)) cur.title = title;
      map.set(id, cur);
    });

    // 2) <audio> 실제 소스 URL (있으면 우선)
    document.querySelectorAll("audio, audio source").forEach((el) => {
      const src = el.currentSrc || el.src || el.getAttribute("src") || "";
      const m = src.match(/([0-9a-f-]{16,})\.(mp3|wav|m4a|ogg)/i);
      if (!m) return;
      const id = m[1].toLowerCase();
      const cur = map.get(id) || { id, title: "", url: null };
      cur.url = src;
      map.set(id, cur);
    });

    // 2.5) 곡 커버 이미지에서 곡 id + 제목(alt) 뽑기
    //   Suno 커버 URL 예: https://cdn2.suno.ai/image_<uuid>.jpeg  (uuid = 곡 id)
    document.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src") || "";
      if (!/suno\.ai/i.test(src)) return;               // 수노 CDN 이미지만
      const m = src.match(UUID);
      if (!m) return;
      const id = m[0].toLowerCase();
      const title = (img.getAttribute("alt") || "").replace(/\s*artwork\s*$/i, "").trim();
      const cur = map.get(id) || { id, title: "", url: null };
      if (title && (!cur.title || title.length > cur.title.length)) cur.title = title;
      map.set(id, cur);
    });

    // 3) 페이지 HTML 전체에서 오디오 URL 패턴 스캔 (JSON 상태 등)
    const html = document.documentElement.innerHTML;
    let mm;
    while ((mm = AUDIO_URL.exec(html))) {
      const url = mm[0];
      const id = mm[1].toLowerCase();
      const cur = map.get(id) || { id, title: "", url: null };
      if (!cur.url) cur.url = url;
      map.set(id, cur);
    }

    // 마무리: URL 없으면 표준 CDN 경로로 구성, 제목 없으면 id 앞부분
    const out = [];
    for (const e of map.values()) {
      if (!UUID.test(e.id) && e.id.length < 16) continue;
      if (!e.url) e.url = `https://cdn1.suno.ai/${e.id}.mp3`;
      if (!e.title) e.title = e.id.slice(0, 8);
      out.push(e);
    }
    return out;
  }

  // ---------- UI ----------
  let panel, listEl, statusEl, barEl, countBadge;
  const allTracks = new Map();  // id -> {id,title,url}  (스크롤하며 누적)
  let tracks = [];              // 렌더용 배열 (allTracks 값)
  const selected = new Set();   // 선택한 곡 id
  const downloadedIds = new Set(); // 이번 세션에 저장 완료한 곡 (초록 ✓ 표시)
  let lastChosen = null;        // 마지막으로 다운로드 시작한 곡 배열(순서)
  let selectAllMode = false;    // 전체 선택 상태면 새로 뜬 곡도 자동 선택
  let opened = false;           // 패널을 한 번이라도 열었나
  let lastUrl = location.href;

  // 현재 화면에서 찾은 곡을 누적 목록에 병합. 새로 추가된 개수 반환.
  function mergeScan() {
    const found = collectTracks();
    let added = 0;
    for (const t of found) {
      const cur = allTracks.get(t.id);
      if (!cur) {
        allTracks.set(t.id, t);
        added++;
        if (selectAllMode) selected.add(t.id); // 전체선택 중이면 새 곡도 포함
      } else {
        if (t.url && !cur.url) cur.url = t.url;
        if (t.title && (!cur.title || t.title.length > cur.title.length)) cur.title = t.title;
      }
    }
    tracks = [...allTracks.values()];
    return added;
  }

  // 다른 플레이리스트로 이동하면 누적 목록 초기화
  function resetIfNavigated() {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      allTracks.clear(); selected.clear(); tracks = [];
      selectAllMode = false; opened = false;
    }
  }

  function launcher() {
    const b = document.createElement("button");
    b.id = "stb-launch";
    b.type = "button";
    b.innerHTML = '<span class="stb-ico">⬇</span><span class="stb-txt">곡 저장</span><span class="stb-n" id="stb-n"></span>';
    b.addEventListener("click", togglePanel);
    document.body.appendChild(b);
    countBadge = b.querySelector("#stb-n");
    refreshCount();
  }

  function refreshCount() {
    mergeScan();
    if (countBadge) countBadge.textContent = allTracks.size ? allTracks.size : "";
  }

  function buildPanel() {
    panel = document.createElement("div");
    panel.id = "stb-panel";
    panel.innerHTML = `
      <div class="stb-head">
        <b>Suno 곡 저장 (WAV)</b>
        <div class="stb-head-btns">
          <button id="stb-rescan" title="다시 스캔">↻</button>
          <button id="stb-close" title="닫기">✕</button>
        </div>
      </div>
      <div class="stb-toolbar">
        <div class="stb-selbtns">
          <button id="stb-all" type="button">전체 선택</button>
          <button id="stb-clear" type="button">전체 해제</button>
          <button id="stb-suno" type="button" title="Suno에서 체크한 곡만 선택">수노 체크만</button>
        </div>
        <span id="stb-sel">0곡 선택</span>
      </div>
      <div id="stb-list" class="stb-list"></div>
      <div class="stb-foot">
        <div id="stb-bar" class="stb-bar"><i></i></div>
        <div id="stb-status" class="stb-status">Suno 목록을 아래로 스크롤하면 곡이 쌓여요. 다 나오면 저장하세요.</div>
        <button id="stb-go" class="stb-go">선택 곡 WAV로 저장</button>
        <button id="stb-stop" class="stb-stop" hidden>■ 중단</button>
      </div>`;
    document.body.appendChild(panel);
    listEl = panel.querySelector("#stb-list");
    statusEl = panel.querySelector("#stb-status");
    barEl = panel.querySelector("#stb-bar");

    panel.querySelector("#stb-close").addEventListener("click", () => (panel.style.display = "none"));
    panel.querySelector("#stb-rescan").addEventListener("click", renderList);
    panel.querySelector("#stb-go").addEventListener("click", startDownload);
    panel.querySelector("#stb-stop").addEventListener("click", stopDownload);
    panel.querySelector("#stb-all").addEventListener("click", () => {
      selectAllMode = true;
      tracks.forEach((t) => selected.add(t.id));   // 지금까지 찾은 곡 전부 선택
      syncChecks();
    });
    panel.querySelector("#stb-clear").addEventListener("click", () => {
      selectAllMode = false;
      selected.clear();                            // 전체 해제
      syncChecks();
    });
    panel.querySelector("#stb-suno").addEventListener("click", () => {
      mergeScan();
      const sunoIds = detectSunoSelectedIds();
      if (!sunoIds.size) {
        // 진단: Suno 체크가 어떤 방식인지 개수 표시 (콘솔 없이 바로 보기)
        const q = (s) => { try { return document.querySelectorAll(s).length; } catch (_) { return "?"; } };
        const inChk = [...document.querySelectorAll('input[type="checkbox"]:checked')].filter((e) => !e.closest("#stb-panel")).length;
        statusEl.textContent =
          `체크 못 찾음 → input:${inChk} / aria-checked:${q('[aria-checked="true"]')} / ` +
          `data-state=checked:${q('[data-state="checked"]')} / role=checkbox:${q('[role="checkbox"]')} / ` +
          `aria-selected:${q('[aria-selected="true"]')} (이 숫자 캡처해 주세요)`;
        return;
      }
      selectAllMode = false;
      selected.clear();
      let n = 0;
      sunoIds.forEach((id) => { if (allTracks.has(id)) { selected.add(id); n++; } });
      renderRows();
      statusEl.textContent = `Suno에서 체크한 ${n}곡 선택됨`;
    });
  }

  // Suno 화면에서 체크(선택)된 곡의 id 수집.
  // 곡 커버 "바로 왼쪽"에 있는 작은 체크박스만 그 곡의 것으로 인정 → 오탐 방지.
  function detectSunoSelectedIds() {
    // 1) 곡 커버 위치 (세로 중심 + 왼쪽 x)
    const rows = [];
    const pushRow = (id, r) => {
      if (!r || !r.height) return;
      rows.push({ id: id.toLowerCase(), cy: r.top + r.height / 2, left: r.left });
    };
    document.querySelectorAll('img[src*="suno.ai"]').forEach((img) => {
      const m = (img.getAttribute("src") || "").match(UUID);
      if (m) pushRow(m[0], img.getBoundingClientRect());
    });

    // 2) 체크된 요소 (진짜 체크박스 우선)
    const checks = [];
    const collect = (sel) => document.querySelectorAll(sel).forEach((n) => {
      if (n.closest("#stb-panel")) return;
      const r = n.getBoundingClientRect();
      if (r.width > 0 && r.width <= 80 && r.height > 0 && r.height <= 80) checks.push(r); // 작은 요소만(체크박스)
    });
    collect('input[type="checkbox"]:checked');
    if (!checks.length) { collect('[role="checkbox"][aria-checked="true"]'); collect('[aria-checked="true"]'); }

    // 3) "같은 줄(±22px) + 커버 바로 왼쪽(간격 0~220px)" 조건을 모두 만족할 때만 매칭
    const ids = new Set();
    checks.forEach((c) => {
      const cy = c.top + c.height / 2, cRight = c.right;
      let best = null, bestGap = 221;
      for (const s of rows) {
        if (Math.abs(s.cy - cy) > 22) continue;      // 같은 줄이 아님
        const gap = s.left - cRight;                  // 체크박스가 커버 왼쪽에 있어야
        if (gap >= -15 && gap < bestGap) { bestGap = gap; best = s.id; }
      }
      if (best) ids.add(best);
    });
    return ids;
  }

  // 목록 갱신(누적 스캔 + 렌더)
  function renderList() {
    resetIfNavigated();
    mergeScan();
    if (!opened) { opened = true; selectAllMode = true; tracks.forEach((t) => selected.add(t.id)); }
    renderRows();
  }

  // tracks 배열을 화면에 그림
  function renderRows() {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!tracks.length) {
      listEl.innerHTML =
        '<div class="stb-empty">곡을 찾지 못했어요.<br>내 라이브러리/플레이리스트에서 곡이 보이도록 <b>천천히 스크롤</b>해 주세요. 스크롤할수록 곡이 쌓여요.</div>';
      updateSel();
      return;
    }
    tracks.forEach((t) => {
      const row = document.createElement("label");
      row.className = "stb-row" + (downloadedIds.has(t.id) ? " stb-done" : "");
      row.dataset.id = t.id;
      row.innerHTML = `<input type="checkbox" /><span class="stb-title"></span>`;
      const cb = row.querySelector("input");
      cb.checked = selected.has(t.id);
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(t.id);
        else { selected.delete(t.id); selectAllMode = false; }
        updateSel();
      });
      row.querySelector(".stb-title").textContent = t.title;
      listEl.appendChild(row);
    });
    updateSel();
  }

  // 저장 완료 표시 (초록 ✓) + 자동 체크 해제 → 다시 저장하면 남은 곡만 이어받기
  function markDone(id) {
    if (!id || downloadedIds.has(id)) return;
    downloadedIds.add(id);
    selected.delete(id);        // 받은 곡은 선택에서 빼둔다
    selectAllMode = false;
    watchdogStalls = 0;         // 실제 저장 = 진전 → 멈춤 카운터 초기화
    if (listEl) {
      const row = listEl.querySelector('.stb-row[data-id="' + (window.CSS && CSS.escape ? CSS.escape(id) : id) + '"]');
      if (row) {
        row.classList.add("stb-done");
        const cb = row.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
      }
    }
    if (panel) updateSel();
  }

  // selected Set 을 화면 체크박스에 반영
  function syncChecks() {
    const cbs = listEl.querySelectorAll('input[type="checkbox"]');
    cbs.forEach((cb, i) => { if (tracks[i]) cb.checked = selected.has(tracks[i].id); });
    updateSel();
  }

  function chosenTracks() {
    return tracks.filter((t) => selected.has(t.id));
  }
  function updateSel() {
    const n = chosenTracks().length;
    panel.querySelector("#stb-sel").textContent = `${n} / ${tracks.length}곡 선택`;
    panel.querySelector("#stb-go").disabled = n === 0;
  }

  function togglePanel() {
    if (!panel) buildPanel();
    const showing = panel.style.display !== "none" && panel.style.display !== "";
    if (showing) { panel.style.display = "none"; return; }
    panel.style.display = "flex";
    renderList();
  }

  // ---------- 다운로드 ----------
  let doneCount = 0, totalCount = 0, errCount = 0, downloading = false;
  let roundStartCount = 0;     // 이번 라운드 시작 시 받은 곡 수
  let stopping = false;        // 사용자가 중단을 눌렀나
  let resumeAfterCancel = false; // 워치독 재시작(취소 후 이어받기)
  let watchdog = null;         // 진행이 멈추면 자동 재시작하는 감시 타이머
  let watchdogStalls = 0;      // 연속 멈춤 횟수 (무한루프 방지)

  function kickWatchdog() {
    clearTimeout(watchdog);
    if (downloading) watchdog = setTimeout(onStall, 75000); // 75초 진행 없으면 멈춘 것으로 간주
  }
  function onStall() {
    if (!downloading || stopping) return;
    if (watchdogStalls >= 3) {  // 3번 연속 진전 없으면 포기
      statusEl.textContent = "여러 번 멈춰서 중단했어요. 남은 곡은 '저장'을 다시 눌러주세요.";
      setBusy(false); panel.querySelector("#stb-stop").disabled = false;
      return;
    }
    watchdogStalls++;
    statusEl.textContent = "느려서 자동으로 다시 시도 중…";
    resumeAfterCancel = true;   // 취소 후 남은 곡 이어받기
    chrome.runtime.sendMessage({ type: "SUNO_CANCEL" }); // 현재 배치 정리
  }

  // 다운로드 중 UI 전환 (진행 중이면 저장 숨기고 중단 표시)
  function setBusy(on) {
    downloading = on;
    panel.querySelector("#stb-go").hidden = on;
    panel.querySelector("#stb-stop").hidden = !on;
    panel.querySelectorAll(".stb-selbtns button, #stb-rescan").forEach((b) => (b.disabled = on));
  }

  function startDownload() {
    const chosen = chosenTracks().filter((t) => !downloadedIds.has(t.id)); // 이미 받은 곡 제외
    if (!chosen.length) { setBusy(false); return; }
    doneCount = 0; errCount = 0; totalCount = chosen.length;
    lastChosen = chosen;
    stopping = false;
    roundStartCount = downloadedIds.size;
    setBar(0);
    statusEl.textContent = `0 / ${totalCount} 준비 중…`;
    setBusy(true);
    kickWatchdog();
    chrome.runtime.sendMessage(
      { type: "SUNO_DOWNLOAD", tracks: chosen.map((t) => ({ id: t.id, title: t.title, url: t.url })) },
      (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          statusEl.textContent = "시작 실패: " + (chrome.runtime.lastError?.message || resp?.reason || "알 수 없음");
          clearTimeout(watchdog); setBusy(false);
        }
      }
    );
  }

  function stopDownload() {
    stopping = true;
    resumeAfterCancel = false;
    clearTimeout(watchdog);
    statusEl.textContent = "중단하는 중…";
    panel.querySelector("#stb-stop").disabled = true;
    chrome.runtime.sendMessage({ type: "SUNO_CANCEL" });
  }

  function setBar(p) { barEl.querySelector("i").style.width = Math.round(p * 100) + "%"; }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !statusEl) return;
    if (msg.type === "TRACK_PROGRESS") {
      kickWatchdog();
      const label = msg.phase === "download" ? "받는 중" : "변환 중";
      const frac = msg.phase === "download" ? msg.index : msg.index + 0.5;
      if (msg.total) setBar(frac / msg.total);
      statusEl.textContent = `${label}: ${msg.title || ""} (${msg.index + 1}/${msg.total})`;
    } else if (msg.type === "TRACK_SAVED") {
      kickWatchdog();
      markDone(msg.id);          // 실제 저장 완료 → ✓ + 자동 체크 해제
    } else if (msg.type === "TRACK_ERROR") {
      kickWatchdog();
      errCount++;
      finalizeTick();
      statusEl.textContent = `오류(건너뜀): ${msg.title || ""}`;
    } else if (msg.type === "BATCH_DONE") {
      clearTimeout(watchdog);
      // 워치독 재시작(취소 후 이어받기)
      if (msg.cancelled && resumeAfterCancel && !stopping) {
        resumeAfterCancel = false;
        setTimeout(() => startDownload(), 1500);
        return;
      }
      // 사용자가 직접 중단
      if (msg.cancelled) {
        statusEl.textContent = "중단됨 — 받던 곡까지 저장됐어요";
        panel.querySelector("#stb-stop").disabled = false; setBusy(false); return;
      }
      // 변환은 끝났지만 마지막 다운로드/✓ 반영에 시간이 걸리므로 잠깐 뒤 판단
      statusEl.textContent = "마무리 중…";
      setTimeout(evaluateAfterBatch, 3500);
    }
  });

  // 한 배치가 끝난 뒤: 남은 곡 자동 이어받기 / 완료 / 실패 판단
  function evaluateAfterBatch() {
    if (stopping) return;
    const remaining = chosenTracks().filter((t) => !downloadedIds.has(t.id));
    const progressed = downloadedIds.size > roundStartCount;
    if (remaining.length && progressed) {
      watchdogStalls = 0;
      statusEl.textContent = `남은 ${remaining.length}곡 자동으로 이어받는 중…`;
      startDownload();
      return;
    }
    if (remaining.length && !progressed) {
      setBar(1);
      statusEl.textContent = `${remaining.length}곡은 못 받았어요(주소 문제일 수 있음). 나머지는 ✓ 저장됨`;
      panel.querySelector("#stb-stop").disabled = false; setBusy(false); return;
    }
    setBar(1);
    statusEl.textContent = "완료! 선택한 곡 전부 저장됐어요 🎉";
    panel.querySelector("#stb-stop").disabled = false; setBusy(false);
  }

  function finalizeTick() {
    doneCount++;
    if (totalCount) setBar(doneCount / totalCount);
  }

  // 초기화 (SPA 대응: 잠시 후 실행)
  const boot = () => { if (!document.getElementById("stb-launch")) launcher(); };
  setTimeout(boot, 1200);

  // 스크롤/DOM 변화 시 곡을 누적하고, 패널이 열려 있으면 목록을 갱신
  function onDomChange() {
    // Suno 가 다시 그리며 버튼을 지웠으면 다시 붙인다 (자동 복구)
    if (!document.getElementById("stb-launch")) { launcher(); return; }
    const before = allTracks.size;
    resetIfNavigated();
    mergeScan();
    if (countBadge) countBadge.textContent = allTracks.size ? allTracks.size : "";
    const panelOpen = panel && panel.style.display !== "none" && panel.style.display !== "";
    if (panelOpen && allTracks.size !== before) renderRows();
  }
  let t;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(onDomChange, 500); })
    .observe(document.body, { childList: true, subtree: true });
})();
