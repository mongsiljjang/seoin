// 오프스크린 문서: 확장 권한(host_permissions)으로 CORS 없이 오디오를 받아
// Web Audio 로 디코딩한 뒤 16-bit PCM WAV 로 인코딩한다.

let audioCtx = null;
function ctx() {
  if (!audioCtx) audioCtx = new (self.AudioContext || self.webkitAudioContext)();
  return audioCtx;
}

function sanitize(name) {
  return (name || "track")
    .replace(/[\\/:*?"<>|\n\r\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "track";
}

// AudioBuffer → WAV(ArrayBuffer), 16-bit PCM
function encodeWAV(audioBuffer) {
  const numCh = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const numFrames = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = numCh * bytesPerSample;
  const dataSize = numFrames * blockAlign;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeStr = (off, s) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  writeStr(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  view.setUint32(16, 16, true);            // PCM chunk size
  view.setUint16(20, 1, true);             // PCM format
  view.setUint16(22, numCh, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);            // bits per sample
  writeStr(36, "data");
  view.setUint32(40, dataSize, true);

  // 채널을 미리 확보해 인터리브
  const channels = [];
  for (let c = 0; c < numCh; c++) channels.push(audioBuffer.getChannelData(c));

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let c = 0; c < numCh; c++) {
      let s = channels[c][i];
      s = s < -1 ? -1 : s > 1 ? 1 : s;              // clamp
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      offset += 2;
    }
  }
  return buffer;
}

// 저장 하위 폴더 이름 정리 (다운로드 폴더 기준 상대경로만 허용)
function sanitizeFolder(folder) {
  let f = (folder == null ? "Suno" : String(folder));
  f = f.replace(/\\/g, "/")                 // 백슬래시 → 슬래시
       .replace(/[:*?"<>|]+/g, " ")         // 파일시스템 금지문자
       .replace(/\.\.+/g, ".")              // 상위경로(..) 차단
       .split("/").map((s) => s.trim()).filter(Boolean).join("/");
  return f; // 비어 있으면 "" (다운로드 폴더 루트에 저장)
}

let cancelled = false;
let currentCtrl = null;
let cancelTrigger = null;   // 진행 중 배치를 즉시 중단시키는 신호

// 변환은 빠른데 저장(디스크 기록)은 느려서, 큰 WAV blob 이 메모리에 쌓이면 막힌다.
// "저장 대기 중인 blob" 수를 제한해 메모리를 일정하게 유지한다.
let pendingBlobs = 0;
let revokeWaiters = [];
function releaseSlot() {
  pendingBlobs = Math.max(0, pendingBlobs - 1);
  const w = revokeWaiters.shift();
  if (w) w();
}
function waitForSlot(max) {
  if (pendingBlobs < max || cancelled) return Promise.resolve();
  return new Promise((res) => {
    const w = () => { clearTimeout(t); res(); };
    const t = setTimeout(() => {
      const i = revokeWaiters.indexOf(w); if (i >= 0) revokeWaiters.splice(i, 1);
      res(); // 25초 안에 저장 신호가 없어도 진행 (교착 방지)
    }, 25000);
    revokeWaiters.push(w);
  });
}
function flushWaiters() { const ws = revokeWaiters; revokeWaiters = []; ws.forEach((w) => w()); }

async function convertOne(track, tabId, index, total, folder) {
  send({ type: "TRACK_PROGRESS", tabId, index, total, phase: "download", title: track.title, id: track.id });
  const ctrl = new AbortController();
  currentCtrl = ctrl;
  const timer = setTimeout(() => ctrl.abort(), 30000); // 30초 시간제한
  let arr;
  try {
    // 1차: 수집된 주소 → 실패하면 2차: audiopipe 공식 스트림 주소로 재시도
    // (cdn1/cdn2 직링크가 막히면서 옛 주소는 403/차단이 나올 수 있음)
    const urls = [track.url];
    const pipe = track.id ? "https://audiopipe.suno.ai/?item_id=" + track.id : null;
    if (pipe && track.url !== pipe) urls.push(pipe);
    let lastErr = null;
    for (const u of urls) {
      try {
        // 로그인 쿠키를 항상 실어 보낸다 (*.suno.ai 권한은 manifest 에 이미 있음)
        const res = await fetch(u, { credentials: "include", signal: ctrl.signal });
        if (!res.ok) throw new Error("HTTP " + res.status);
        arr = await res.arrayBuffer();
        // audiopipe 는 곡을 못 줄 때도 200 + 빈 몸통을 돌려준다 → 실패로 판정해야 다음 주소를 시도한다
        if (!arr || arr.byteLength < 256) throw new Error("빈 응답 — 비공개 곡이거나 로그인 필요");
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
        arr = undefined;
        if (ctrl.signal.aborted) break; // 시간초과/취소면 더 시도하지 않음
      }
    }
    if (lastErr) throw lastErr;
  } finally {
    clearTimeout(timer);
    currentCtrl = null;
  }

  send({ type: "TRACK_PROGRESS", tabId, index, total, phase: "convert", title: track.title, id: track.id });
  // 오디오 공간 하나를 계속 재사용한다 (크롬은 AudioContext 를 6개까지만 허용 → 곡마다 새로 만들면 막힘)
  let audioBuffer = await ctx().decodeAudioData(arr);
  const wav = encodeWAV(audioBuffer);
  audioBuffer = null;          // 큰 디코드 결과는 바로 참조 해제 (메모리 반납)
  const blob = new Blob([wav], { type: "audio/wav" });
  const blobUrl = URL.createObjectURL(blob);

  const name = sanitize(track.title) + ".wav";
  pendingBlobs++;   // 저장(다운로드 완료)될 때까지 메모리에 남아있는 blob
  send({
    type: "TRACK_READY",
    tabId, index, total, id: track.id,
    blobUrl,
    filename: folder ? folder + "/" + name : name,
  });
}

// 곡 하나가 걸려도 전체가 멈추지 않도록 전체 시간제한
function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("시간 초과")), ms);
    promise.then((v) => { clearTimeout(timer); resolve(v); },
                 (e) => { clearTimeout(timer); reject(e); });
  });
}

async function runBatch(tracks, tabId, folderRaw) {
  const total = tracks.length;
  const folder = sanitizeFolder(folderRaw);
  cancelled = false;
  // 중단 신호: 이 promise 가 거부되면 현재 곡 처리를 기다리지 않고 즉시 빠져나온다
  const cancelP = new Promise((_, rej) => { cancelTrigger = () => rej(new Error("취소됨")); });
  cancelP.catch(() => {});
  let saved = 0;
  for (let i = 0; i < total; i++) {
    if (cancelled) break;
    await waitForSlot(4);   // 저장 대기 blob 이 너무 많으면 잠깐 대기 (메모리 조절)
    if (cancelled) break;
    let done = false, lastErr = null;
    // 최대 2번 시도 (걸리면 재시도, 그래도 안 되면 건너뜀)
    for (let attempt = 0; attempt < 2 && !done && !cancelled; attempt++) {
      try {
        await Promise.race([withTimeout(convertOne(tracks[i], tabId, i, total, folder), 35000), cancelP]);
        done = true; saved++;
      } catch (e) {
        lastErr = e;
        if (currentCtrl) { try { currentCtrl.abort(); } catch (_) {} } // 멈춘 요청 강제 종료
      }
    }
    if (!done && !cancelled) {
      send({ type: "TRACK_ERROR", tabId, index: i, total, error: String(lastErr && lastErr.message || lastErr), title: tracks[i].title });
    }
  }
  cancelTrigger = null;
  send({ type: "BATCH_DONE", tabId, total, saved, cancelled });
}

function send(m) { chrome.runtime.sendMessage(m).catch(() => {}); }

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.type === "CONVERT_BATCH") runBatch(msg.tracks || [], msg.tabId, msg.folder);
  else if (msg.type === "CANCEL") {
    cancelled = true;
    pendingBlobs = 0;
    flushWaiters();                       // 대기 중인 슬롯 해제
    if (currentCtrl) { try { currentCtrl.abort(); } catch (_) {} }
    if (cancelTrigger) cancelTrigger();   // 현재 곡 기다리지 않고 즉시 중단
  }
  else if (msg.type === "REVOKE" && msg.blobUrl) { URL.revokeObjectURL(msg.blobUrl); releaseSlot(); }
});

// 서비스워커가 안 자게 keep-alive 포트를 열고 주기적으로 신호를 보낸다
let kaPort = null;
function keepAlive() {
  try {
    kaPort = chrome.runtime.connect({ name: "keepalive" });
    kaPort.onDisconnect.addListener(() => { kaPort = null; });
  } catch (_) { kaPort = null; }
}
keepAlive();
setInterval(() => {
  if (!kaPort) keepAlive();
  try { kaPort && kaPort.postMessage({ ping: 1 }); } catch (_) { kaPort = null; }
}, 20000);

// 로드 완료 → 백그라운드에 준비됐다고 알림 (대기 작업 받기)
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
