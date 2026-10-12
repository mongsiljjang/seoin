/* 보험 임플란트 청구 안내 시험 — index.html 의 안내 문구 함수를 그대로 떼어 와 돌린다.

   무엇을 보나: 상병명·세 단계·핵심 규칙이 빠지지 않았는지, 수가 금액이 새어 들어오지 않았는지,
   안내일 뿐이라는 말이 붙어 있는지, 화면(케이스 폼·대장 머리)에 실제로 걸려 있는지.
   근거는 docs/INSURANCE_STEPS.md. 규칙이 바뀌면 이 시험의 문구도 근거 문서와 같이 고친다.
   돌리는 법:  node test/보험안내.mjs        (설치 필요 없음) */
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
const g = new Function(`${grab('insGuideHtml')}; return insGuideHtml();`)();
const text = g.replace(/<[^>]+>/g,' ').replace(/\s+/g,' ');
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };

t('주 상병 K08.1 과 상병명이 있다', text.includes('K08.1') && text.includes('국한성 치주병에 의한 치아상실'));
t('사전등록번호 13자리를 적는 자리(MT014)와 치식 오기가 지급불능이라는 말이 있다', text.includes('MT014') && text.includes('13자리') && text.includes('지급불능'));
t('1·2·3단계가 모두 있다', ['1단계','2단계','3단계'].every(s=>text.includes(s)));
t('앱의 1차 수술이 청구 2단계라는 대응이 적혀 있다', /2단계[^<]*1차 수술/.test(text));
t('1단계: 사전등록 소급 불가', /사전등록/.test(text) && text.includes('소급'));
t('2단계: 재식립은 1회, 시술중지→재등록', text.includes('1회') && text.includes('시술중지') && text.includes('재등록'));
t('3단계: 청구 뒤에는 시술중지 등록이 안 된다', /3단계를 청구한 뒤에는 시술중지 등록이 안 됩니다/.test(text));
t('3단계: 맞춤형 지대주 비급여 · PFM 외 재료는 시술 전체 비급여', text.includes('맞춤형 지대주는 비급여') && text.includes('PFM') && text.includes('시술 전체가 비급여'));
t('공통: 끝난 뒤 청구 · 병원 이동 불가 · 평생 2개 · 사후 3개월', ['끝난 뒤에','옮기면','평생 2개','3개월'].every(s=>text.includes(s)));
t('수가 금액이 없다(원 · 점수 · 상한금액)', !/\d[\d,]*\s*원/.test(text) && !/\d+\s*만\s*원/.test(text) && !text.includes('상한금액') && !/\d[\d,.]*\s*점/.test(text));
t('안내일 뿐이라는 말과 근거가 붙어 있다', text.includes('안내일 뿐') && text.includes('국민건강보험공단'));
t('케이스 폼과 임플란트 대장 머리에 안내가 걸려 있다', (js.match(/insGuideRow\(\)/g)||[]).length>=3 && js.includes('function insGuideRow'));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
