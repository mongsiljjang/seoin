/* 임플란트 회사 트리 시험 — index.html 의 트리 함수를 그대로 떼어 와 돌린다.

   무엇을 보나: 오스템·메가젠·네오·디오가 제품이 없어도 맨 앞에 오는지, 다른 회사를 추가하면 뒤에 붙는지,
   한 회사 아래로 부품(픽스처·어버트먼트·힐링캡 …)이 묶이고 정해진 순서로 나오는지, 수량·부족·품절이 맞게 세어지는지,
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
const m = new Function(`const IMP_BRANDS_FIRST=${first}, IMP_PART_ORDER=${order}; ${['impBrandOrder','impTree','impAddGuideHtml'].map(grab).join('\n')}; return {impBrandOrder,impTree,impAddGuideHtml,IMP_BRANDS_FIRST,IMP_PART_ORDER};`)();
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const V=(q,min=3)=>({qty:q,minQty:min});
const L=[
  {id:'1',brand:'오스템',line:'TS III',part:'픽스처',variants:[V(8),V(0),V(2),V(5)]},
  {id:'2',brand:'오스템',line:'힐링 어버트먼트',part:'힐링캡',variants:[V(10,5),V(4,5)]},
  {id:'3',brand:'오스템',line:'트랜스퍼 어버트먼트',part:'어버트먼트',variants:[V(6)]},
  {id:'4',brand:'덴티움',line:'SuperLine',part:'픽스처',variants:[V(3)]},
];
t('기본 회사 4곳이 순서대로 맨 앞에 온다(제품이 없어도)', JSON.stringify(m.impBrandOrder([]))===JSON.stringify(['오스템','메가젠','네오','디오']));
t('다른 회사는 기본 회사 뒤에 붙는다', JSON.stringify(m.impBrandOrder(L))===JSON.stringify(['오스템','메가젠','네오','디오','덴티움']));
t('다른 회사가 여럿이면 처음 나온 순서', JSON.stringify(m.impBrandOrder([{brand:'B사'},{brand:'A사'},{brand:'B사'}]).slice(4))===JSON.stringify(['B사','A사']));
t('기본 회사 이름이 앞뒤 공백이 있어도 같은 회사로 묶인다', m.impBrandOrder([{brand:' 오스템 '}]).length===4);

const tr=m.impTree(L,'오스템');
t('오스템 아래 부품이 픽스처 → 어버트먼트 → 힐링캡 순서로 나온다', JSON.stringify(tr.map(g=>g.part))===JSON.stringify(['픽스처','어버트먼트','힐링캡']));
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

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
