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

async function convertOne(track, tabId, index, total) {
  send({ type: "TRACK_PROGRESS", tabId, index, total, phase: "download", title: track.title });
  const res = await fetch(track.url, { credentials: "omit" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const arr = await res.arrayBuffer();

  send({ type: "TRACK_PROGRESS", tabId, index, total, phase: "convert", title: track.title });
  const audioBuffer = await ctx().decodeAudioData(arr.slice(0));
  const wav = encodeWAV(audioBuffer);
  const blob = new Blob([wav], { type: "audio/wav" });
  const blobUrl = URL.createObjectURL(blob);

  send({
    type: "TRACK_READY",
    tabId, index, total,
    blobUrl,
    filename: "Suno/" + sanitize(track.title) + ".wav",
  });
}

async function runBatch(tracks, tabId) {
  const total = tracks.length;
  for (let i = 0; i < total; i++) {
    try {
      await convertOne(tracks[i], tabId, i, total);
    } catch (e) {
      send({ type: "TRACK_ERROR", tabId, index: i, total, error: String(e && e.message || e), title: tracks[i].title });
    }
  }
  send({ type: "BATCH_DONE", tabId, total });
}

function send(m) { chrome.runtime.sendMessage(m).catch(() => {}); }

chrome.runtime.onMessage.addListener((msg) => {
  if (!msg || msg.target !== "offscreen") return;
  if (msg.type === "CONVERT_BATCH") runBatch(msg.tracks || [], msg.tabId);
  else if (msg.type === "REVOKE" && msg.blobUrl) URL.revokeObjectURL(msg.blobUrl);
});
