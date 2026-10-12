/* 임플란트 회사 트리 시험 — index.html 의 트리 함수를 그대로 떼어 와 돌린다.

   무엇을 보나: 오스템·메가젠·네오·디오가 제품이 없어도 맨 앞에 오는지, 다른 회사를 추가하면 뒤에 붙는지,
   한 회사 아래로 부품(픽스처·어버트먼트·힐링 어버트먼트 …)이 묶이고 정해진 순서로 나오는지, 수량·부족·품절이 맞게 세어지는지,
   회사 추가 방법 안내가 있는지.
   돌리는 법:  node test/임플란트트리.mjs        (설치 필요 없음) */
import fs from 'fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m=>m[1]).join('\n');
function grab(name){
  const i = js.indexOf('function '+name+'(');
  if(i<0) throw new Error(`index.html 에 ${name} 이 없다 — 이름이 바뀌었는지 본다`);
  let d=0;
  for(let k=js.indexOf('{', i); k<js.length; k++){
    if(js[k]==='{') d++; else if(js[k]==='}' && --d===0) return js.slice(i, k+1);
  }
  throw new Error(name+' 의 끝을 못 찾았다');
}
const first = /const IMP_BRANDS_FIRST=(\[[^\]]*\]);/.exec(js)[1], order = /const IMP_PART_ORDER=(\[[^\]]*\]);/.exec(js)[1];
const m = new Function(`const IMP_BRANDS_FIRST=${first}, IMP_PART_ORDER=${order}; const PART_HA='힐링 어버트먼트'; ${['impBrandOrder','impTree','impAddGuideHtml','normPart','partShow'].map(grab).join('\n')}; return {impBrandOrder,impTree,impAddGuideHtml,normPart,partShow,IMP_BRANDS_FIRST,IMP_PART_ORDER};`)();
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const V=(q,min=3)=>({qty:q,minQty:min});
const L=[
  {id:'1',brand:'오스템',line:'TS III',part:'픽스처',variants:[V(8),V(0),V(2),V(5)]},
  {id:'2',brand:'오스템',line:'힐링 어버트먼트',part:'힐링 어버트먼트',variants:[V(10,5),V(4,5)]},
  {id:'3',brand:'오스템',line:'트랜스퍼 어버트먼트',part:'어버트먼트',variants:[V(6)]},
  {id:'4',brand:'덴티움',line:'SuperLine',part:'픽스처',variants:[V(3)]},
];
t('기본 회사 4곳이 순서대로 맨 앞에 온다(제품이 없어도)', JSON.stringify(m.impBrandOrder([]))===JSON.stringify(['오스템','메가젠','네오','디오']));
t('다른 회사는 기본 회사 뒤에 붙는다', JSON.stringify(m.impBrandOrder(L))===JSON.stringify(['오스템','메가젠','네오','디오','덴티움']));
t('다른 회사가 여럿이면 처음 나온 순서', JSON.stringify(m.impBrandOrder([{brand:'B사'},{brand:'A사'},{brand:'B사'}]).slice(4))===JSON.stringify(['B사','A사']));
t('기본 회사 이름이 앞뒤 공백이 있어도 같은 회사로 묶인다', m.impBrandOrder([{brand:' 오스템 '}]).length===4);

const tr=m.impTree(L,'오스템');
t('오스템 아래 부품이 픽스처 → 어버트먼트 → 힐링 어버트먼트 순서로 나온다', JSON.stringify(tr.map(g=>g.part))===JSON.stringify(['픽스처','어버트먼트','힐링 어버트먼트']));
t('부품 줄마다 제품과 수량이 합쳐진다', tr[0].items.length===1 && tr[0].qty===15 && tr[2].qty===14);
t('부족·품절 규격이 센다(품절은 0개, 부족은 최소 이하)', tr[0].zero===1 && tr[0].low===1 && tr[2].low===1 && tr[2].zero===0);
t('제품이 없는 회사는 빈 트리다', m.impTree(L,'메가젠').length===0);
t('다른 회사의 제품이 섞이지 않는다', m.impTree(L,'덴티움').length===1 && m.impTree(L,'덴티움')[0].items[0].id==='4');
t('목록에 없는 부품 이름은 맨 뒤에 가나다순으로', JSON.stringify(m.impTree([{brand:'X',part:'나사',variants:[]},{brand:'X',part:'가이드',variants:[]},{brand:'X',part:'픽스처',variants:[]}],'X').map(g=>g.part))===JSON.stringify(['픽스처','가이드','나사']));
t('부품이 비어 있으면 기타로 묶인다', m.impTree([{brand:'X',part:'',variants:[]}],'X')[0].part==='기타');

const g=m.impAddGuideHtml().replace(/<[^>]+>/g,' ');
t('회사 추가 방법 안내에 ＋ 회사 · 같은 이름으로 묶임 · 기본 회사가 적혀 있다', g.includes('＋ 회사') && g.includes('똑같이') && g.includes('오스템·메가젠·네오·디오'));
t('화면에 안내(i)와 트리가 걸려 있다', js.includes("sechead('임플란트 회사', impAddGuideHtml())") && js.includes('impTreeHtml(currentBrand'));
t('제품 추가 폼이 회사·부품을 미리 채운다', js.includes('function openImplantForm(edit, preBrand, prePart)'));

// 힐링 어버트먼트(HA) — 예전 이름 힐링캡과 약어 HA 를 같은 부품으로 읽는다
t('힐링캡·HA·힐링어버트먼트(HA) 가 모두 힐링 어버트먼트로 읽힌다', ['힐링캡','힐링 캡','HA','ha','힐링 어버트먼트','힐링어버트먼트','힐링 어버트먼트(HA)'].every(s=>m.normPart(s)==='힐링 어버트먼트'));
t('다른 부품 이름은 그대로 둔다', m.normPart('픽스처')==='픽스처' && m.normPart('어버트먼트')==='어버트먼트' && m.normPart('')==='');
t('옛 이름(힐링캡)으로 저장된 제품도 힐링 어버트먼트 줄에 묶인다', (()=>{ const g=m.impTree([{brand:'X',part:'힐링캡',variants:[]},{brand:'X',part:'힐링 어버트먼트',variants:[]}],'X'); return g.length===1 && g[0].part==='힐링 어버트먼트' && g[0].items.length===2; })());
t('트리에는 힐링 어버트먼트 (HA) 로 보인다', m.partShow('힐링 어버트먼트')==='힐링 어버트먼트 (HA)' && m.partShow('픽스처')==='픽스처');
t('부품 이름에 힐링캡이 더는 안 나온다(화면 코드)', !/part:'힐링캡'|'힐링캡',/.test(js.replace("p.part==='힐링캡'","")));

// 재고 창(칸을 눌렀을 때)에서 바로 규격을 지울 수 있다 — 예전에는 편집 창 안쪽에 숨어 있었다
t('재고 창에 규격 제거 버튼이 있고 지우기 전에 잃는 숫자를 물어본다', (()=>{ const k=js.indexOf('function openVariant(pid,vid)'); const seg=js.slice(k, js.indexOf('function setPhysical', k)); return seg.includes('delVariant(') && seg.includes('규격 제거') && js.slice(js.indexOf('function delVariant(pid,vid)'), js.indexOf('function delVariant(pid,vid)')+700).includes('confirm('); })());

// 맨 앞 '선택' 칸 — 처음에는 아무것도 안 펼쳐지고, 회사를 눌러야 세부가 보인다
t("회사 줄 맨 앞에 '선택' 칸이 있다", js.includes("selectBrand('')") && js.includes('>선택</button>'));
t('처음에는 회사를 자동으로 고르지 않는다(첫 회사 자동 선택 코드가 없다)', !js.includes('currentBrand=brands[0]'));
t('회사를 누르면 예전처럼 그 회사의 첫 제품(과 규격 표)이 바로 잡힌다', js.includes('if(currentBrand && !cur){ const t=impTree(list,currentBrand); if(t.length){ cur=t[0].items[0]; currentImplantId=cur.id; impOpenFor(cur); } }'));
t('회사 트리는 회사가 골라졌을 때만 그려지고, 선택일 때도 첫 제품의 규격 표는 보인다', js.includes('(currentBrand? impTreeHtml(currentBrand') && js.includes(': (list[0]? cardBox(list[0])'));
t('회사를 누르면 이전에 펼친 부품 줄을 접고 제품 선택을 비워 첫 제품부터 다시 잡는다', (()=>{ const k=js.indexOf('function selectBrand(b){'); const s=js.slice(k, js.indexOf('function toggleImpGroup', k)); return s.includes('currentImplantId=null') && s.includes('impOpen.delete'); })());

// 재고 화면 글에서 실사 라는 말을 쓰지 않는다(심평원 실사와 헷갈림) — 주석은 제외
t('코드 어디에도 실사 라는 말이 없다(심평원 실사 이야기만 예외)', !js.split(String.fromCharCode(10)).some(l=>l.includes('실사') && !l.includes('심평원')));

// 규격 추가 창에서 삭제 — 적힌 규격이 등록돼 있으면 지운다
t('규격 추가 창에도 삭제 버튼이 있고(추가 옆), 적힌 규격으로 찾아 지운다', js.includes('delVariantByInput(') && js.includes('function delVariantByInput(pid)') && js.includes('등록된 규격이 아니에요'));

// 제품을 눌렀을 때 — 규격 표 자리로 데려가고, 부품 줄은 접을 수 있다
t('제품을 누르면 규격 표 자리(impCard)로 스크롤한다', js.includes("getElementById('impCard')") && js.includes('scrollIntoView'));
t('부품 줄을 그릴 때마다 열어 두지 않는다(접을 수 있다) — 고를 때만 연다', !js.includes("if(cur) impOpen.add(") && js.includes('function impOpenFor(p)') && js.includes('impOpenFor(implantById(id))'));

// 화면 글에서 실재고 대신 남은 재고
t('코드 어디에도 실재고 라는 말이 없다(남은 재고로 바꿈)', !js.includes('실재고') && js.includes('남은 재고'));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
