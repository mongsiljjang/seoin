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
  let panel, listEl, statusEl, barEl, countBadge, tracks = [];
  const selected = new Set();   // 선택한 곡 id (다시 스캔해도 유지)
  let initialized = false;      // 처음 열 때 한 번만 전체 선택

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
    const n = collectTracks().length;
    if (countBadge) countBadge.textContent = n ? n : "";
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
        </div>
        <span id="stb-sel">0곡 선택</span>
      </div>
      <div id="stb-list" class="stb-list"></div>
      <div class="stb-foot">
        <div id="stb-bar" class="stb-bar"><i></i></div>
        <div id="stb-status" class="stb-status">내가 만든 곡을 골라 한 번에 WAV로 저장합니다.</div>
        <button id="stb-go" class="stb-go">선택 곡 WAV로 저장</button>
      </div>`;
    document.body.appendChild(panel);
    listEl = panel.querySelector("#stb-list");
    statusEl = panel.querySelector("#stb-status");
    barEl = panel.querySelector("#stb-bar");

    panel.querySelector("#stb-close").addEventListener("click", () => (panel.style.display = "none"));
    panel.querySelector("#stb-rescan").addEventListener("click", renderList);
    panel.querySelector("#stb-go").addEventListener("click", startDownload);
    panel.querySelector("#stb-all").addEventListener("click", () => {
      tracks.forEach((t) => selected.add(t.id));   // 지금 목록 전부 선택
      syncChecks();
    });
    panel.querySelector("#stb-clear").addEventListener("click", () => {
      selected.clear();                            // 전체 해제
      syncChecks();
    });
  }

  function renderList() {
    tracks = collectTracks();
    // 처음 열 땐 편하게 전체 선택, 그 뒤 다시 스캔은 기존 선택 유지
    if (!initialized) { tracks.forEach((t) => selected.add(t.id)); initialized = true; }
    listEl.innerHTML = "";
    if (!tracks.length) {
      listEl.innerHTML =
        '<div class="stb-empty">곡을 찾지 못했어요.<br>내 라이브러리/플레이리스트 페이지에서 곡이 화면에 보이도록 스크롤한 뒤 ↻ 를 눌러주세요.</div>';
      updateSel();
      return;
    }
    tracks.forEach((t) => {
      const row = document.createElement("label");
      row.className = "stb-row";
      row.innerHTML = `<input type="checkbox" /><span class="stb-title"></span>`;
      const cb = row.querySelector("input");
      cb.checked = selected.has(t.id);
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(t.id); else selected.delete(t.id);
        updateSel();
      });
      row.querySelector(".stb-title").textContent = t.title;
      listEl.appendChild(row);
    });
    updateSel();
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
    panel.querySelector("#stb-sel").textContent = n + "곡 선택";
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
  let doneCount = 0, totalCount = 0, errCount = 0;

  function startDownload() {
    const chosen = chosenTracks();
    if (!chosen.length) return;
    doneCount = 0; errCount = 0; totalCount = chosen.length;
    setBar(0);
    statusEl.textContent = `0 / ${totalCount} 준비 중…`;
    panel.querySelector("#stb-go").disabled = true;
    chrome.runtime.sendMessage(
      { type: "SUNO_DOWNLOAD", tracks: chosen.map((t) => ({ id: t.id, title: t.title, url: t.url })) },
      (resp) => {
        if (chrome.runtime.lastError || !resp || !resp.ok) {
          statusEl.textContent = "시작 실패: " + (chrome.runtime.lastError?.message || resp?.reason || "알 수 없음");
          panel.querySelector("#stb-go").disabled = false;
        }
      }
    );
  }

  function setBar(p) { barEl.querySelector("i").style.width = Math.round(p * 100) + "%"; }

  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || !statusEl) return;
    if (msg.type === "TRACK_PROGRESS") {
      const label = msg.phase === "download" ? "받는 중" : "변환 중";
      const frac = msg.phase === "download" ? msg.index : msg.index + 0.5;
      if (msg.total) setBar(frac / msg.total);
      statusEl.textContent = `${label}: ${msg.title || ""} (${msg.index + 1}/${msg.total})`;
    } else if (msg.type === "TRACK_ERROR") {
      errCount++;
      finalizeTick();
      statusEl.textContent = `오류: ${msg.title || ""} – ${msg.error || ""}`;
    } else if (msg.type === "BATCH_DONE") {
      // 남은 진행률 보정은 다운로드 이벤트로 처리되지 않으므로 여기서 마무리
      setBar(1);
      const okN = totalCount - errCount;
      statusEl.textContent = `완료: ${okN}곡 저장${errCount ? `, ${errCount}곡 실패` : ""} → 다운로드 폴더/Suno`;
      panel.querySelector("#stb-go").disabled = false;
    }
  });

  function finalizeTick() {
    doneCount++;
    if (totalCount) setBar(doneCount / totalCount);
  }

  // 초기화 (SPA 대응: 잠시 후 실행)
  const boot = () => { if (!document.getElementById("stb-launch")) launcher(); };
  setTimeout(boot, 1200);
  // 페이지 이동/DOM 변화 시 카운트 갱신
  let t;
  new MutationObserver(() => { clearTimeout(t); t = setTimeout(refreshCount, 800); })
    .observe(document.body, { childList: true, subtree: true });
})();
