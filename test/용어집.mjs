/* 용어집 시험 — index.html 에서 glossaryData·glossaryFind 를 그대로 떼어 와 돌린다.

   찾는 말이 앞에 오는지, 대소문자·마침표·띄어쓰기를 무시하는지, 목록이 서로 겹치지 않는지 본다.
   돌리는 법:  node test/용어집.mjs        (설치 필요 없음) */
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
const { glossaryData, glossaryFind } =
  new Function(grab('glossaryData')+';'+grab('glossaryFind')+';return {glossaryData, glossaryFind};')();

let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const first = (q,c)=> (glossaryFind(q,c)[0]||[])[1];

const all = glossaryData();
t('항목이 모두 분류·말·뜻을 갖는다', all.every(e=>e[0]&&e[1]&&e[2]));
t('분류는 처방·치과·검사·임플란트뿐', all.every(e=>['처방','치과','검사','임플란트'].includes(e[0])));
t('같은 분류 안에서 말이 겹치지 않는다', new Set(all.map(e=>e[0]+'|'+e[1])).size===all.length);

t('TID → 하루 3번', glossaryFind('TID')[0][2].startsWith('하루 3번'));
t('소문자 tid 도 찾는다', first('tid')==='TID');
t('마침표를 넣어도 찾는다 (t.i.d)', first('t.i.d')==='TID');
t('BID 는 BID 가 먼저', first('bid')==='BID');
t('PO 를 치면 PO 가 먼저(post·polish 보다 앞)', first('po')==='PO');
t('한글로도 찾는다 (발치)', glossaryFind('발치').some(e=>e[1].startsWith('Ex')));
t('뜻의 글자로도 찾는다 (신경치료)', glossaryFind('신경치료').some(e=>e[1]==='RCT'));
t('치식 번호로 FDI 설명이 나온다 (46)', glossaryFind('46').some(e=>e[1].startsWith('FDI')));
t('없는 말은 빈 목록', glossaryFind('ㅁㄴㅇㄹzzzq').length===0);
t('빈 검색어는 전체', glossaryFind('').length===all.length);
t('분류로 좁힌다 (임플란트)', glossaryFind('', '임플란트').every(e=>e[0]==='임플란트') && glossaryFind('', '임플란트').length>0);
t('분류와 검색어를 함께 건다', glossaryFind('수술','임플란트').length>=2 && glossaryFind('수술','처방').length===0);
t('QD 에 헷갈림 주의가 붙어 있다', !!glossaryData().find(e=>e[1]==='QD')[4]);
t('QOD 에 헷갈림 주의가 붙어 있다', !!glossaryData().find(e=>e[1]==='QOD')[4]);
// 용량·처방을 권하는 문구가 들어오지 않게 — 용어집은 풀이만 한다
t('용량을 권하는 말이 없다', !all.some(e=>/(투여하세요|처방하세요|복용하세요|드세요)/.test(e.join(' '))));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
