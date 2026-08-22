/* 규격 숫자 읽기 시험 — index.html 에서 함수를 그대로 떼어 와 돌린다.

   × 를 손으로 치는 게 일이라 칸을 둘로 나눴고, 한 칸에 붙여 써도 받는다.
   붙여 쓴 숫자는 짐작하지 않는다 — 물리적으로 불가능한 읽기를 지우고,
   하나만 남을 때 넣는다. 둘 이상이면 물어본다.

   근거는 docs/IMPLANT_SPECS.md. 임플란트에 두께 30mm 는 없다.

   돌리는 법:  node test/규격읽기.mjs        (설치 필요 없음) */
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
// 상수도 손으로 베끼지 않는다 — 베끼면 실물과 조용히 어긋난다
const SPEC = js.match(/^const SPEC_AXIS = \{[\s\S]*?\n\};/m);
if(!SPEC) throw new Error('index.html 에 const SPEC_AXIS 가 없다');

const f = new Function(`${SPEC[0]}
${['parseDL','specAxis','hasAxis','specNum','dlLabel','sameSpec','specGuess'].map(grab).join('\n')}
return {parseDL,specAxis,hasAxis,specNum,dlLabel,sameSpec,specGuess};`)();

let pass=0, fail=0;
const ok=(name,got,want)=>{ const y=JSON.stringify(got)===JSON.stringify(want); y?pass++:fail++;
  console.log(`${y?'✅':'❌'} ${name}${y?'':`  — ${JSON.stringify(want)} 여야 하는데 ${JSON.stringify(got)}`}`); };
// 읽기가 하나면 그 이름, 없으면 '', 여럿이면 후보를 늘어놓는다
const 읽기 = (t, part='픽스처') => {
  const g=f.specGuess(t, part);
  return g.length===1 ? f.dlLabel(g[0].b,g[0].s) : (g.length?g.map(x=>f.dlLabel(x.b,x.s)):'');
};

console.log('\n── × 를 안 쳐도 된다 ──');
ok('띄어쓰기로 나눠도 읽는다',  읽기('4.0 12'), '4×12');
ok('쉼표로 나눠도 읽는다',      읽기('4.0,12'), '4×12');
ok('붙임표도 읽는다',          읽기('4-12'),   '4×12');
ok('x 를 쳐도 읽는다',         읽기('4.0x12'), '4×12');
ok('×를 쳐도 읽는다',          읽기('4.0×12'), '4×12');
ok('뒤에 mm 가 붙어도 읽는다', 읽기('4.0×12mm'), '4×12');
ok('Ø 가 앞에 와도 읽는다',    읽기('Ø4.0×12'), '4×12');

console.log('\n── 붙여 쓴 숫자 — 불가능한 읽기를 지운다 ──');
ok('3010 은 3×10 하나뿐이다',  읽기('3010'), '3×10');   // 두께 30mm 는 없다
ok('4012 는 4×12 하나뿐이다',  읽기('4012'), '4×12');
ok('512 는 5×12 로 읽힌다',    읽기('512'),  '5×12');
ok('40120 은 못 읽는다',       읽기('40120'), '');
ok('숫자 하나면 못 읽는다',    읽기('6'), '');
ok('빈 값이면 못 읽는다',      읽기(''), '');

console.log('\n── 두께 30mm 짜리 임플란트는 없다 ──');
{
  const g=f.specGuess('3010','픽스처');
  ok('후보가 하나뿐이다',      g.length, 1);
  ok('두께 30 은 후보에 없다', g.some(x=>x.b===30), false);
  ok('길이 0 도 후보에 없다',  g.some(x=>x.s===0), false);
}

console.log('\n── 부품마다 범위가 다르다 ──');
ok('픽스처 둘째 축은 길이',    f.specAxis('픽스처').s, '길이');
ok('힐링 둘째 축은 잇몸높이',  f.specAxis('힐링캡').s, '잇몸높이');
ok('픽스처는 두 축을 쓴다',    f.hasAxis('픽스처'), true);
ok('골이식재는 두 축이 아니다', f.hasAxis('골이식'), false);
ok('길이 20 은 픽스처에 있다', f.specGuess('4 20','픽스처').length, 1);
// 범위는 막는 데 쓰지 않는다. 나눠 적었으면 그대로 받는다 — 모르는 기준으로
// 막으면 양치기가 된다. 범위는 붙여 쓴 숫자를 읽을 때만 쓴다.
ok('나눠 적으면 범위 밖도 받는다', 읽기('4 40'), '4×40');
// 4mm 길이 임플란트는 실재한다(Straumann Short). 그래서 440 은 4×4 로 읽힌다.
// 다만 이런 것은 화면에서 확인을 받는다 — 하나로 읽혀도 붙여 쓴 것은 물어본다.
ok('440 은 4×4 로만 읽힌다',      읽기('440'), '4×4');
ok('나눠 적은 것은 구분자로 안다',  f.specGuess('4 12','픽스처')[0].sure, true);
ok('붙여 친 것은 구분자가 없다',    f.specGuess('440','픽스처')[0].sure, false);
ok('4040 도 4×4 로만 읽힌다',      읽기('4040'), '4×4');   // 40 은 어느 축에도 없다
ok('아무 데도 안 맞으면 못 읽는다', 읽기('9999'), '');
ok('두께가 너무 얇아도 못 읽는다',  읽기('1111'), '');
ok('GH 3 은 힐링에 있다',      읽기('4.5 3','힐링캡'), '4.5×3');

console.log('\n── 두께가 될 수 없는 숫자는 반드시 갈라진다 ──');
// 브라우저에서 잡은 결함이다. 둘째 칸에 값이 남아 있는데 첫 칸에 3010 을
// 치면 갈라지지 않아 '3010×12' 라는 이름이 조용히 만들어졌다.
{
  const 두께되나 = (raw, part='픽스처') => {
    const ax=f.specAxis(part), n=parseFloat(raw);
    return isFinite(n) && String(n)===raw && n>=ax.bMin && n<=ax.bMax;
  };
  ok('3.5 는 두께로 말이 된다 — 안 건드린다', 두께되나('3.5'), true);
  ok('4 도 두께로 말이 된다',                두께되나('4'),   true);
  ok('3010 은 두께가 될 수 없다',            두께되나('3010'), false);
  ok('그래서 3010 은 갈라진다',              읽기('3010'),     '3×10');
  ok('40 도 두께가 될 수 없다',              두께되나('40'),   false);
  ok('다만 40 은 갈라지지도 않는다',          읽기('40'),       '');
}

console.log('\n── 이름을 늘 같은 모양으로 만든다 ──');
ok('4.0 은 4 로 적는다',       f.dlLabel('4.0','12'), '4×12');
ok('4 도 4 로 적는다',         f.dlLabel('4','12'),   '4×12');
ok('4.50 은 4.5 로 적는다',    f.dlLabel('4.50','8.5'), '4.5×8.5');
ok('둘째 축이 없으면 하나만',   f.dlLabel('4',''),     '4');
ok('숫자가 아니면 빈 값',       f.dlLabel('가','12'),  '');

console.log('\n── 같은 규격을 두 줄로 만들지 않는다 ──');
ok('4×12 와 4.0×12 는 같다',   f.sameSpec('4×12','4.0×12'), true);
ok('Ø4×12 와 4.0×12 도 같다',  f.sameSpec('Ø4×12','4.0×12'), true);
ok('4.0*12 와 4×12 도 같다',   f.sameSpec('4.0*12','4×12'), true);
ok('4×12 와 4×10 은 다르다',   f.sameSpec('4×12','4×10'), false);
ok('힐링 이름은 글자로 본다',   f.sameSpec('Ø4.5 GH3','Ø4.5 GH3'), true);
ok('GH 가 다르면 다르다',       f.sameSpec('Ø4.5 GH3','Ø4.5 GH4'), false);

console.log('\n── 기존 이름을 깨지 않는다 ──');
ok('Ø4.5 GH3 은 두 축이 아니다', f.parseDL('Ø4.5 GH3'), null);
ok('Ø3.5×8.5 는 그대로 읽힌다',  f.parseDL('Ø3.5×8.5'), {d:3.5,l:8.5});
ok('4.0×12 도 그대로 읽힌다',    f.parseDL('4.0×12'),   {d:4,l:12});

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
process.exit(fail?1:0);
