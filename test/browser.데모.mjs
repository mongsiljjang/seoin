import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const base = process.env.BASE;
let pass=0, fail=0;
const ok=(n,c)=>{ c?(pass++,console.log('✅ '+n)) : (fail++,console.log('❌ '+n)); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:412,height:900} });
// Firebase 가 못 붙는 상황을 재현하지 않는다 — 데모는 서버를 아예 안 불러야 한다
let firebaseHit = 0;
await ctx.route(/googleapis\.com|firebaseio|identitytoolkit/, r=>{ firebaseHit++; r.abort(); });
const page = await ctx.newPage();

await page.goto(base + '/index.html?demo=1', {waitUntil:'networkidle'});
await page.waitForTimeout(1200);

const gateShown = await page.locator('#gate.show').count();
ok('로그인 화면이 안 뜬다', gateShown===0);

const barText = (await page.locator('#demoBar').innerText().catch(()=>'')) || '';
ok('보기용 띠가 뜬다', barText.includes('저장되지 않습니다'));

const staff = await page.evaluate(()=> (typeof DB!=='undefined' && DB.staff? DB.staff.length : 0));
ok('가짜 직원이 들어 있다 ('+staff+'명)', staff>0);
const body = await page.locator('body').innerText();
ok('화면에 가짜 직원 이름이 보인다', body.includes('김간호'));

const stored = await page.evaluate(()=> Object.keys(localStorage).filter(k=>k.startsWith('hospital_mgr')||k==='hosp_uid'));
ok('이 기기에 아무것도 안 남긴다 ('+JSON.stringify(stored)+')', stored.length===0);

ok('서버를 부르지 않는다 ('+firebaseHit+'회)', firebaseHit===0);

// 데모가 아닌 평소 화면은 그대로 로그인 화면이어야 한다
const p2 = await ctx.newPage();
await p2.goto(base + '/index.html', {waitUntil:'networkidle'});
await p2.waitForTimeout(1200);
ok('데모가 아니면 예전처럼 로그인 화면', (await p2.locator('#gate.show').count())===1);

console.log(`\n${pass} 통과 / ${fail} 실패`);
await browser.close();
process.exit(fail?1:0);
