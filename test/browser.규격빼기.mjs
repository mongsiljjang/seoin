import { chromium } from './_playwright.mjs';
const base=process.env.BASE; let pass=0,fail=0;
const ok=(n,c)=>{ c?(pass++,console.log('✅ '+n)):(fail++,console.log('❌ '+n)); };
const b=await chromium.launch(); const ctx=await b.newContext({viewport:{width:412,height:900}});
await ctx.route(/googleapis\.com|gstatic|identitytoolkit/, r=>r.abort());
const page=await ctx.newPage();
page.on('dialog', d=>d.accept());
await page.goto(base+'/index.html?demo=1',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1500);

// 임플란트 화면으로
await page.evaluate(()=>go('inv')); await page.waitForTimeout(800);
// 임플란트 칸으로 (화면 안의 버튼/탭을 찾아 누른다)
for(const t of ['임플란트','🦷']){
  const el=page.locator(`text=${t}`).first();
  if(await el.count()){ await el.click(); await page.waitForTimeout(700); break; }
}
let body=await page.locator('body').innerText();
if(!body.includes('규격 추가')){
  const card=page.locator('text=TS III').first();
  if(await card.count()){ await card.click(); await page.waitForTimeout(800); body=await page.locator('body').innerText(); }
}
ok('＋ 규격 추가가 보인다', body.includes('규격 추가'));
ok('－ 규격 빼기가 보인다', body.includes('규격 빼기'));

const before=await page.evaluate(()=>DB.implants[0].variants.length);
await page.locator('text=－ 규격 빼기').first().click(); await page.waitForTimeout(500);
const m=await page.locator('body').innerText();
ok('빼기 화면에 규격 목록이 뜬다', m.includes('뺄 규격을 고르세요'));
await page.locator('button:has-text("빼기")').nth(1).click();   // 목록의 첫 항목
await page.waitForTimeout(700);
const after=await page.evaluate(()=>DB.implants[0].variants.length);
ok(`규격이 하나 줄었다 (${before} → ${after})`, after===before-1);

console.log(`\n${pass} 통과 / ${fail} 실패`);
await b.close(); process.exit(fail?1:0);
