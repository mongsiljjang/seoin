/* 수첩·라벨 사진 판독 — 버셀 서버 함수 (껍데기)

   하는 일은 요청을 _core.js 의 handle() 에 넘기고 결과를 응답으로 돌려주는 것뿐이다.
   서비스(Gemini·Claude)·키·직원 확인·이름 가리기 같은 실제 일은 모두 _core.js 에 있다.
   별도 서버로 옮길 때는 _core.js 를 그대로 가져가고 이 껍데기만 그 서버 방식(Express 등)으로 다시 쓴다 — docs/SERVER.md 6장.

   환경변수:  GEMINI_API_KEY · ANTHROPIC_API_KEY (둘 다 선택 — 하나도 없고 요청에 내 키도 없으면 꺼진 것)
              SCAN_PROVIDER (gemini | anthropic) · SCAN_MODEL_GEMINI · SCAN_MODEL_ANTHROPIC
              FIREBASE_PROJECT_ID (기본 hospital-d0819) · SCAN_PER_DAY (서버 키 사용자별 하루 한도, 기본 5) */

const core = require('./_core.js');

async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const r = await core.handle({ method: req.method, body: req.body, env: process.env });
  return res.status(r.status).json(r.json);
}

module.exports = handler;
Object.assign(module.exports, core);        // 시험이 쓰는 이름들(cleanLines 등)을 그대로 내보낸다
