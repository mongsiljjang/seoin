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

async function convertOne(track, tabId, index, total, folder) {
  send({ type: "TRACK_PROGRESS", tabId, index, total, phase: "download", title: track.title });
  const ctrl = new AbortController();
  currentCtrl = ctrl;
  const timer = setTimeout(() => ctrl.abort(), 30000); // 30초 시간제한
  let arr;
  try {
    const res = await fetch(track.url, { credentials: "omit", signal: ctrl.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    arr = await res.arrayBuffer();
  } finally {
    clearTimeout(timer);
    currentCtrl = null;
  }

  send({ type: "TRACK_PROGRESS", tabId, index, total, phase: "convert", title: track.title });
  const audioBuffer = await ctx().decodeAudioData(arr.slice(0));
  const wav = encodeWAV(audioBuffer);
  const blob = new Blob([wav], { type: "audio/wav" });
  const blobUrl = URL.createObjectURL(blob);

  const name = sanitize(track.title) + ".wav";
  send({
    type: "TRACK_READY",
    tabId, index, total,
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
    if (currentCtrl) { try { currentCtrl.abort(); } catch (_) {} }
    if (cancelTrigger) cancelTrigger();   // 현재 곡 기다리지 않고 즉시 중단
  }
  else if (msg.type === "REVOKE" && msg.blobUrl) URL.revokeObjectURL(msg.blobUrl);
});

// 로드 완료 → 백그라운드에 준비됐다고 알림 (대기 작업 받기)
chrome.runtime.sendMessage({ type: "OFFSCREEN_READY" }).catch(() => {});
