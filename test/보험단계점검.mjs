/* 보험 임플란트 단계 점검 시험 — index.html 의 점검 함수를 그대로 떼어 와 돌린다.

   무엇을 보나: 단계 순서·누락·날짜 뒤바뀜·같은 날·치식 범위·같은 치아 중복·재식립·보철 뒤 페일이 알림으로 나오는지,
   멀쩡한 기록에는 아무것도 안 나오는지, 일반 케이스는 점검하지 않는지.
   근거는 docs/INSURANCE_STEPS.md 5장. 청구 판정이 아니라 알림이다.
   돌리는 법:  node test/보험단계점검.mjs        (설치 필요 없음) */
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
const names=['insDayN','insFdiOk','caseWho','caseSamePerson','insChecks','insCheckAll'];
const m = new Function(`const INS_PROS_WAIT_DAYS=90; ${names.map(grab).join('\n')}; return {${names.join(',')}};`)();
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const TODAY='2026-10-12';
const mk=(o)=>Object.assign({id:'c'+Math.random(),chart:'A-1',insur:'보험',d0:'2026-09-01',d1:'2026-09-10',d2:'2026-09-24',d3:'2026-10-05',teeth:[{fdi:36}],createdAt:'2026-09-10'},o);
const codes=(c,cases=[c])=>m.insChecks(c,cases,TODAY).map(x=>x.code);

// 멀쩡한 기록 / 일반 케이스
t('1·2·3단계가 순서대로 있는 보험 케이스는 아무것도 안 나온다', codes(mk({}))+''==='');
t('일반 케이스는 점검하지 않는다(날짜가 뒤죽박죽이어도)', codes(mk({insur:'일반',d1:'',d3:'2020-01-01'}))+''==='');

// 누락
t('1차 수술은 있는데 진단일이 없으면 알린다(약하게)', (()=>{ const r=m.insChecks(mk({d0:''}),[],TODAY); return r.length===1 && r[0].code==='no1' && r[0].lv==='note'; })());
t('보철 장착일만 있고 1차 수술이 없으면 확인으로 알린다', (()=>{ const r=m.insChecks(mk({d1:'',d2:''}),[],TODAY); return r.some(x=>x.code==='no2' && x.lv==='warn'); })());

// 순서
t('보철 장착일이 1차 수술보다 앞이면 확인으로 알린다', codes(mk({d3:'2026-09-01'})).includes('order'));
t('2차 수술이 1차 수술보다 앞이어도 알린다', codes(mk({d2:'2026-09-01'})).includes('order'));
t('진단일이 1차 수술보다 뒤여도 알린다', codes(mk({d0:'2026-09-20'})).includes('order'));
t('날짜 칸이 비어 있으면 순서를 따지지 않는다', codes(mk({d0:'',d2:'',d3:''})).includes('order')===false);

// 같은 날
t('진단일과 1차 수술일이 같은 날이면 알린다(약하게)', (()=>{ const r=m.insChecks(mk({d0:'2026-09-10'}),[],TODAY); return r.some(x=>x.code==='same'&&x.lv==='note'); })());
t('1차 수술일과 보철 장착일이 같은 날이면 알린다', codes(mk({d3:'2026-09-10'})).includes('same'));
t('2차 수술(힐링)은 청구 단계가 아니라서 같은 날이어도 안 걸린다', codes(mk({d2:'2026-09-10'})).includes('same')===false);

// 보철 안 들어옴
t('1차 수술 90일 뒤에도 보철 장착일이 없으면 경과일을 알린다', (()=>{ const r=m.insChecks(mk({d0:'2026-06-01',d1:'2026-06-10',d2:'',d3:''}),[],TODAY); return r.some(x=>x.code==='nopros' && /124일/.test(x.text)); })());
t('아직 90일 전이면 안 알린다', codes(mk({d1:'2026-09-20',d3:''})).includes('nopros')===false);
t('보철 기한을 판정하는 말(초과·위반·기한)이 없다', !m.insChecks(mk({d0:'2026-06-01',d1:'2026-06-10',d3:''}),[],TODAY).some(x=>/초과|위반|기한/.test(x.text)));

// 치식
t('치식이 11~48 범위를 벗어나면 확인으로 알린다', codes(mk({teeth:[{fdi:19}]})).includes('fdi'));
t('치식이 비면 확인으로 알린다', codes(mk({teeth:[]})).includes('fdi'));
t('FDI 11~18·21~28·31~38·41~48 은 통과', ['11','18','21','28','31','38','41','48'].every(n=>m.insFdiOk(n)) && ['10','19','29','39','49','50','5'].every(n=>!m.insFdiOk(n)));

// 같은 치아 중복 · 재식립 · 보철 뒤 페일
{ const a=mk({id:'a',d1:'2026-05-01',d0:'2026-04-20',d2:'',d3:''}), b=mk({id:'b',d1:'2026-09-10'});
  t('같은 환자·같은 치아가 보험 케이스 두 건이면 뒤에 적은 쪽에 알린다', codes(b,[a,b]).includes('dup') && !codes(a,[a,b]).includes('dup')); }
{ const a=mk({id:'a',d1:'2026-05-01',teeth:[{fdi:36,fail:true}]}), b=mk({id:'b',d1:'2026-09-10'});
  const r=m.insChecks(b,[a,b],TODAY);
  t('앞 케이스가 그 치아 페일이었으면 중복이 아니라 재식립 안내로 나온다', r.some(x=>x.code==='redo' && /시술중지/.test(x.text)) && !r.some(x=>x.code==='dup')); }
{ const a=mk({id:'a',chart:'A-1'}), b=mk({id:'b',chart:'B-2',d1:'2026-09-11'});
  t('다른 환자의 같은 치아는 중복이 아니다', !codes(b,[a,b]).includes('dup')); }
t('보철 장착일이 있는데 페일이 적혀 있으면 시술중지 불가를 알린다', codes(mk({teeth:[{fdi:36,fail:true}]})).includes('fail3'));
t('보철 장착일이 없는 페일에는 이 알림이 안 나온다', codes(mk({d3:'',teeth:[{fdi:36,fail:true}]})).includes('fail3')===false);

// 차트번호 없이 이름(가린 모양)+생년월일로 같은 환자를 가른다
{ const nm=(o)=>mk(Object.assign({chart:'',pname:'김ㅁ수',birth:'1948-03-02'},o));
  const a=nm({id:'a',d1:'2026-05-01',d0:'2026-04-20',d2:'',d3:''}), b=nm({id:'b',d1:'2026-09-10'});
  t('차트번호가 없어도 이름·생년월일이 같으면 같은 환자라 같은 치아 중복을 찾는다', codes(b,[a,b]).includes('dup')); }
{ const a=mk({id:'a',chart:'',pname:'김ㅁ수',birth:'1948-03-02',d1:'2026-05-01',d0:'2026-04-20',d2:'',d3:''}), b=mk({id:'b',chart:'',pname:'김ㅁ수',birth:'1951-07-09'});
  t('이름이 같아도 생년월일이 다르면 다른 환자다', !codes(b,[a,b]).includes('dup')); }
{ const a=mk({id:'a',chart:'',pname:'김ㅁ수',birth:'',d1:'2026-05-01',d0:'2026-04-20',d2:'',d3:''}), b=mk({id:'b',chart:'',pname:'김ㅁ수',birth:''});
  t('이름만 있고 생년월일이 없으면 같은 환자라고 하지 않는다(엉뚱한 알림 방지)', !codes(b,[a,b]).includes('dup')); }
{ const a=mk({id:'a',chart:'A-1',pname:'김ㅁ수',birth:'1948-03-02'}), b=mk({id:'b',chart:'A-2',pname:'김ㅁ수',birth:'1948-03-02'});
  t('차트번호가 둘 다 있으면 차트번호가 다르면 다른 환자다', m.caseSamePerson(a,b)===false); }
t('표시 이름: 차트번호 → 이름 → 둘 다 없으면 (이름 없음)', m.caseWho({chart:'A-1',pname:'김ㅁ수'})==='A-1 김ㅁ수' && m.caseWho({pname:'김ㅁ수'})==='김ㅁ수' && m.caseWho({})==='(이름 없음)');
t('저장할 때 차트번호나 이름 중 하나만 있으면 된다(화면 코드)', js.includes("if(!chart && !$('#lcName').value.trim())"));

// 정렬 · 판정하는 말 없음
{ const ok=mk({id:'ok',chart:'A-1'}), bad=mk({id:'bad',chart:'A-2',d3:'2026-09-01'}), note=mk({id:'nt',chart:'A-3',d0:''});
  const all=m.insCheckAll([ok,note,bad],TODAY);
  t('점검 목록에는 걸린 케이스만 들어가고 확인할 것이 있는 쪽이 위에 온다', all.length===2 && all[0].c.id==='bad'); }
t('알림 문구에 금액·급여/비급여 판정이 없다', (()=>{ const all=[mk({d0:'',d3:'2026-09-01',teeth:[{fdi:19}]})].flatMap(c=>m.insChecks(c,[c],TODAY)); return all.every(x=>!/\d+\s*원|비급여|급여 대상|환수|삭감/.test(x.text)); })());

// 화면에 걸려 있다
t('케이스 폼에 보철 장착일 칸이 있고 저장·목록에 쓰인다', js.includes('id="lcD3"') && js.includes("d3:$('#lcD3').value") && js.includes('보철 ${c.d3}'));
t('임플란트 대장 머리에 점검 상자가 걸려 있다', js.includes('insCheckBox(DB.implantCases, todayKey())'));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
