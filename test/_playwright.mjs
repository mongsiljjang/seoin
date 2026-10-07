// playwright 를 찾는 순서: 환경변수 PLAYWRIGHT_PATH → test/node_modules → 서버 기본 경로
const 후보 = [process.env.PLAYWRIGHT_PATH, 'playwright', '/opt/node22/lib/node_modules/playwright/index.mjs'].filter(Boolean);
let mod, 마지막오류;
for (const p of 후보) { try { mod = await import(p); break; } catch (e) { 마지막오류 = e; } }
if (!mod) throw new Error('playwright 를 못 찾았다 — test 폴더에서 npm i -D playwright 하거나 PLAYWRIGHT_PATH 를 지정한다\n' + 마지막오류);
export const chromium = mod.chromium ?? mod.default.chromium;
