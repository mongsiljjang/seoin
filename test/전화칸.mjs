/* 전화번호 칸 시험 — index.html 에서 phoneProblem 을 그대로 떼어 와 돌린다.

   사용자가 전화번호 칸에 이메일(ppashong74@gmail.com)을 넣었더니 앱이 숫자만
   뽑아 '74' 로 읽었고, 화면은 그걸 지적하지 않았다. 이제 저장·로그인 전에 짚는다.

   돌리는 법:  node test/전화칸.mjs        (설치 필요 없음) */
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
const phoneProblem = new Function(grab('normPhone')+';'+grab('phoneProblem')+';return phoneProblem;')();

let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };

t('이메일은 막는다', !!phoneProblem('ppashong74@gmail.com'));
t('이름 같은 글자도 막는다', !!phoneProblem('김간호'));
t('휴대폰 숫자만 통과', phoneProblem('01011112222')==='');
t('하이픈·공백 섞여도 통과', phoneProblem(' 010-1111-2222 ')==='');
t('집 전화(02) 통과', phoneProblem('02-123-4567')==='');
t('숫자 두 자리(74)는 막는다', !!phoneProblem('74'));
t('빈 칸은 막는다', !!phoneProblem(''));
t('너무 긴 숫자는 막는다', !!phoneProblem('0101111222233'));
t('0으로 시작 안 하면 막는다', !!phoneProblem('11112222333'));
for(const id of ['sPhone','lgPhone','suPhone'])
  t(id+' 입력 뒤에 phoneProblem 을 부른다', js.includes("phoneProblem($('#"+id+"').value)"));

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
