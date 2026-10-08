/* 급여 열쇠 시험 — index.html 의 잠금 함수를 그대로 떼어 와 돌린다.

   무엇을 보나: 사람마다 다른 열쇠로 같은 자료가 열리는지, 권한 없는 사람은 못 여는지,
   열쇠를 바꾸거나 사람을 더하고 빼도 이미 잠근 기록이 계속 열리는지(누적),
   복구 코드로 열리는지, 옛 방식(열쇠 하나)에서 기록을 잃지 않고 옮겨지는지.
   돌리는 법:  node test/급여열쇠.mjs        (설치 필요 없음, node 20 이상) */
import fs from 'fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function grab(name, kw='function'){
  const i = js.indexOf(kw+' '+name+'(');
  if(i<0) throw new Error(`index.html 에 ${name} 이 없다 — 이름이 바뀌었는지 본다`);
  let d=0;
  for(let k=js.indexOf('{', i); k<js.length; k++){
    if(js[k]==='{') d++; else if(js[k]==='}' && --d===0) return js.slice(i, k+1);
  }
  throw new Error(name+' 의 끝을 못 찾았다');
}
const sync=['b64e','b64d','payIsLegacy','paySlotOf','payNewDEK','payRecoveryMake','payRecoveryNorm','payDropSlot'];
const asyn=['payDerive','payEnc','payDec','payWrap','payUnwrap','payCreate','paySetSlot','payNewRecovery','payOpen','payOpenRecovery'];
const make = ()=>{
  const src = `
    const PAY_ITER=2000, PAY_ALPHA=${JSON.stringify('ABCDEFGHJKLMNPQRSTUVWXYZ23456789')};
    const now=()=>'2026-10-08T00:00:00Z';
    let DB={payLock:null};
    ${sync.map(n=>grab(n)).join('\n')}
    ${asyn.map(n=>grab(n,'async function')).join('\n')}
    return {get DB(){return DB;}, set DB(v){DB=v;}, ${[...sync,...asyn].join(',')}};`;
  return new Function(src)();
};
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const m=make();

// 1) 처음 정하기 — 원장님 한 칸 + 복구 코드
const r=await m.payCreate('owner','원장님열쇠123');
const box=await m.payEnc(r.dek,{cells:['100','200']});          // 잠가 둔 기록 하나
t('처음 정하면 칸이 하나(원장님)이고 옛 방식이 아니다', m.DB.payLock.slots.length===1 && !m.payIsLegacy());
t('복구 코드 모양 XXXX-XXXX-XXXX-XXXX', /^([A-HJ-NP-Z2-9]{4}-){3}[A-HJ-NP-Z2-9]{4}$/.test(r.code));
t('저장된 잠금 정보에 열쇠·복구 코드 글자가 없다', !JSON.stringify(m.DB.payLock).includes('원장님열쇠123') && !JSON.stringify(m.DB.payLock).includes(r.code));
{ const k=await m.payOpen('원장님열쇠123','owner'); t('원장님 열쇠로 기록이 열린다', !!k && (await m.payDec(k,box)).cells[1]==='200'); }
t('틀린 열쇠는 안 열린다', (await m.payOpen('틀린열쇠abc','owner'))===null);
t('권한 없는 사람(칸 없음)은 같은 열쇠를 넣어도 안 열린다', (await m.payOpen('원장님열쇠123','sil'))===null);

// 2) 실장님에게 권한 주기 — 각자 자기 열쇠
const dek=await m.payOpen('원장님열쇠123','owner');
await m.paySetSlot('sil','실장님열쇠456',dek);
{ const k=await m.payOpen('실장님열쇠456','sil'); t('권한을 받은 실장님은 자기 열쇠로 같은 기록을 연다', !!k && (await m.payDec(k,box)).cells[0]==='100'); }
t('실장님 열쇠로 원장님 칸은 안 열린다', (await m.payOpen('실장님열쇠456','owner'))===null);

// 3) 누적 — 열쇠를 바꿔도 기록은 그대로
await m.paySetSlot('sil','새실장열쇠789',dek);
t('실장님이 열쇠를 바꾸면 칸은 여전히 둘이다', m.DB.payLock.slots.length===2);
t('바꾼 뒤 예전 열쇠는 안 열리고 새 열쇠로 열린다', (await m.payOpen('실장님열쇠456','sil'))===null && !!(await m.payOpen('새실장열쇠789','sil')));
{ const k=await m.payOpen('새실장열쇠789','sil'); t('열쇠를 바꿔도 이미 잠근 기록이 그대로 열린다(누적)', (await m.payDec(k,box)).cells[1]==='200'); }

// 4) 권한 빼기
t('칸이 둘일 때 실장님 칸을 뺄 수 있다', m.payDropSlot('sil')===true);
t('뺀 뒤 실장님은 못 연다', (await m.payOpen('새실장열쇠789','sil'))===null);
t('원장님은 그대로 열고 기록도 그대로다', (await m.payDec(await m.payOpen('원장님열쇠123','owner'),box)).cells[0]==='100');
t('마지막 한 칸은 못 뺀다', m.payDropSlot('owner')===false && m.DB.payLock.slots.length===1);

// 5) 복구 코드
{ const k=await m.payOpenRecovery(r.code.toLowerCase().replace(/-/g,' ')); t('복구 코드(소문자·공백이 섞여도)로 같은 기록이 열린다', !!k && (await m.payDec(k,box)).cells[1]==='200'); }
t('틀린 복구 코드는 안 열린다', (await m.payOpenRecovery('AAAA-AAAA-AAAA-AAAA'))===null);
{ const k=await m.payOpenRecovery(r.code); await m.paySetSlot('owner','복구후새열쇠000',k);
  t('복구 코드로 연 뒤 새 열쇠를 정해도 기록이 열린다', (await m.payDec(await m.payOpen('복구후새열쇠000','owner'),box)).cells[0]==='100'); }
{ const c2=await m.payNewRecovery(dek);
  t('복구 코드를 다시 만들면 예전 코드는 못 쓰고 새 코드는 쓴다', (await m.payOpenRecovery(r.code))===null && !!(await m.payOpenRecovery(c2))); }

// 6) 옛 방식(열쇠 하나) → 새 방식, 기록 유지
{ const m2=make();
  const salt=m2.b64e(crypto.getRandomValues(new Uint8Array(16)));
  const old=await m2.payDerive('예전열쇠abcd', salt, false);
  const oldBox=await m2.payEnc(old,{cells:['옛기록']});
  m2.DB={payLock:{salt, check:await m2.payEnc(old,{v:'mediops'}), at:'x', by:'owner'}};
  t('slots 가 없으면 옛 방식으로 알아본다', m2.payIsLegacy());
  t('옛 방식은 옛 열쇠로 기록이 열린다', (await m2.payDec(await m2.payOpen('예전열쇠abcd','owner'),oldBox)).cells[0]==='옛기록');
  t('옛 방식에서 틀린 열쇠는 안 열린다', (await m2.payOpen('틀린열쇠abcd','owner'))===null);
  const odek=await m2.payOpen('예전열쇠abcd','owner');
  await m2.payCreate('owner','새열쇠abcdef',odek);
  t('옮긴 뒤 새 방식이 되고', !m2.payIsLegacy());
  t('옮기기 전에 잠근 기록이 다시 잠그지 않고도 새 열쇠로 열린다', (await m2.payDec(await m2.payOpen('새열쇠abcdef','owner'),oldBox)).cells[0]==='옛기록');
}

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
