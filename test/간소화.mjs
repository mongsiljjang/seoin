/* 직원 화면 간소화 시험 — 2026-11-09 사용자: "복잡하면 직원들이 못 쓴다, 최대한 미니멀하게. 그러나 기능은 전부."
   무엇을 보나: 수량 버튼이 '바꾸기'가 아니라 '더하기'인지(클릭 수 오차 원인), 직원에게 규격 만들기·빼기가 안 보이는지,
   규격 창이 입고·사용 두 개 + 더보기인지, 교육 켜기·끄기가 스위치인지.
   돌리는 법:  node test/간소화.mjs        (설치 필요 없음) */
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
let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const { qtyNext, qtyStepHtml } = new Function(`${grab('qtyNext')}\n${grab('qtyStepHtml')}\nreturn {qtyNext, qtyStepHtml};`)();

// 클릭 수 오차: ＋ 를 세 번 누르면 1 → 4 가 아니라, 처음 1에서 2·3·4 로 하나씩 늘어난다
let v='1'; v=qtyNext(v,1); v=qtyNext(v,1); v=qtyNext(v,1);
t('＋ 세 번 → 4 (누를 때마다 더한다)', v===4);
t('+5 두 번 → 11', qtyNext(qtyNext('1',5),5)===11);
t('－ 는 1 아래로 안 내려간다', qtyNext('1',-1)===1);
t('빈 칸에서 ＋ → 1', qtyNext('',1)===1);
t('숫자 버튼이 값을 바꿔치기하던 옛 방식(.value=숫자)이 남아 있지 않다', !/onclick="(qAmt|ivAmt)\.value=\$\{n\}"/.test(html));
const h=qtyStepHtml('ivAmt',[5,10]);
t('수량 칸에 － ＋ +5 +10 이 있다', h.includes("qtyStep('ivAmt',-1)") && h.includes("qtyStep('ivAmt',1)") && h.includes('+5') && h.includes('+10'));
t('임플란트·일반 재고 둘 다 새 수량 칸을 쓴다', html.includes("qtyStepHtml('ivAmt'") && html.includes("qtyStepHtml('qAmt'"));

const ov=grab('openVariant');
t('규격 창: 입고·사용이 먼저, 나머지는 더보기 안', ov.indexOf("'in')\">＋ 입고") < ov.indexOf('details class="more"') && ov.indexOf('details class="more"') < ov.indexOf('남은 재고 입력'));
t('규격 편집·제거는 관리자만', /class="row admin-only"><button class="btn soft grow" onclick="openVariantForm/.test(ov));
const mx=grab('matrixHtml');
t('표: 직원은 빈 칸을 눌러도 규격이 안 생긴다', mx.includes("(!adm || (p.cellHide||[]).includes("));
t('표: 직원은 굵기·길이 숫자를 눌러 줄을 빼지 못한다', mx.includes('adm?`<th title="눌러서 빼기"') && mx.includes('if(adm) t+=`<tr><td class="rowh"><button'));
const card=grab('implantCard');
t('규격 추가·빼기·일괄추가 버튼은 관리자만', card.includes('<div class="btnrow admin-only"'));
const ri=grab('renderImplant');
t('임플란트 첫 화면 요약·점검 상자는 관리자만', ri.includes('summary3 admin-only') && ri.includes('<div class="admin-only">${gapBox('));

t('교육 켜기·끄기는 스위치', html.includes('class="sw" checked') && html.includes("onchange=\"eduSwitch('${it.id}',this)\"") && !html.includes(">켜기</button>"));
t('GPS 출근 확인도 스위치', /id="geoOn" class="sw"/.test(html));
const es=grab('eduSwitch');
t('해당되는 교육을 끌 땐 한 번 묻는다', es.includes("eduState(it).st==='yes'") && es.includes('confirm('));
t('꺼 둔 교육도 다시 켤 자리가 남는다', js.includes("const maybeOff=off.filter(it=>eduState(it).st!=='no')"));

// 불편 신고
const { fbDevice, fbText } = new Function(`${grab('fbDevice')}\n${grab('fbText')}\nreturn {fbDevice, fbText};`)();
t('불편 신고: 기기 종류를 알아본다', fbDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)')==='아이폰' && fbDevice('Mozilla/5.0 (Linux; Android 14)')==='안드로이드' && fbDevice('Mozilla/5.0 (Windows NT 10.0)')==='윈도우 PC');
t('불편 신고: 개발자에게 넘길 글이 한 줄씩 나온다', fbText([{at:'2026-11-09T01:00:00Z',screen:'재고 · 임플란트',device:'아이폰',name:'김',text:'안 닫혀요'}])==='1. [2026-11-09 · 재고 · 임플란트 · 아이폰 · 김] 안 닫혀요');
t('불편 신고는 공용 문서에 담겨 직원도 쓸 수 있다', /const B_SHARED = \[[^\]]*'feedback'/.test(js));
t('불편 신고 버튼이 직원 설정·관리자 설정 둘 다에 있다', grab('openStaffMenu').includes('openFeedback()') && grab('openMenu').includes('openFeedbackList()'));
t('불편 신고 칸에 환자 정보 쓰지 말라는 안내', grab('openFeedback').includes('환자 이름·연락처는 적지 마세요'));

// LOT 빠짐 경고 (2026-11-09 "LOT 누락됐을 경우 경고창")
const { lotMissing } = new Function(`${grab('lotMissing')}\nreturn {lotMissing};`)();
t('LOT 빈칸·공백만 있으면 빠진 것', lotMissing('') && lotMissing('  ') && lotMissing(null) && !lotMissing('A123'));
const dva=grab('doVariantAdjust');
t('임플란트 입고·사용: LOT 가 비면 경고창, 취소하면 LOT 칸으로', dva.includes('lotMissing(lot) && !confirm(LOT_WARN)') && dva.includes("$('#ivLot')") && dva.indexOf('confirm(LOT_WARN)') < dva.indexOf('const before=v.qty'));
t('입고·사용 기록마다 쓴 LOT 를 남긴다', dva.includes('DB.implantLogs[0].lot=lot'));
t('입고 때 LOT 칸은 비어서 열린다(지난 LOT 를 그대로 쓰는 실수 방지) · 지난 LOT 버튼은 따로', grab('adjustVariant').includes("value=\"${type==='in'?'':esc(v.lot||'')}\"") && grab('adjustVariant').includes('지난 LOT 그대로'));
t('케이스 저장: 고정체 LOT 가 비면 경고창', grab('saveCase').includes('confirm(`${noLot.map(n=>\'#\'+n).join(\', \')} 고정체의 `+LOT_WARN)'));
t('규격 일괄추가 창에 파일 올리기·사진 찍기 문', (b=>b.includes('📂 파일 올리기') && b.includes('📷 사진 찍기') && b.includes('openPurchase()'))(grab('openBulkVariants')));

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
if(fail) process.exit(1);
