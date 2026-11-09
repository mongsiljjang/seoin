/* 잘못 넣은 입고·출고 고치기 시험 — index.html 에서 함수를 이름으로 떼어 와 돌린다.

   무엇을 보나: 기록 수량을 고치면 재고가 그 차이만큼만 움직이는지, 뒤에 쌓인 기록의 전·후 숫자가
   같이 밀리는지, 고친 뒤 재고가 0 밑으로 내려가면 막는지, 그 뒤에 세기·보정이 있으면 막는지,
   직원은 자기가 오늘 넣은 것만 고치는지, 교육 계획서 자리가 생기는지.
   돌리는 법:  node test/기록고치기.mjs        (설치 필요 없음) */
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
const names=['logFixCan','logBA','logFixPlan','logFixApply','ivFixable','eduInit'];
const m = new Function(`
  const ROLE_OWNER='owner', ROLE_HR='hr';
  const tms=v=>+new Date(v);
  const pad=n=>String(n).padStart(2,'0');
  const todayKey=(d=new Date())=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
  const now=()=>'2026-11-09T10:00:00';
  let DB={};
  ${names.map(grab).join('\n')}
  return {${names.join(',')}, setDB:x=>{DB=x;}, getDB:()=>DB};`)();

let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };

// 일반 재료: 0 → 입고 100(잘못, 10이 맞음) → 출고 5 → 지금 95
const mk=()=>{
  const a={id:'a',type:'in',amount:100,qtyBefore:0,qtyAfter:100,at:'2026-11-09T09:00:00',by:'s1'};
  const b={id:'b',type:'out',amount:5,qtyBefore:100,qtyAfter:95,at:'2026-11-09T09:30:00',by:'s1'};
  return {a,b,list:[b,a]};
};
{ const {a,b,list}=mk();
  const p=m.logFixPlan(list,a,10,95);
  t('입고 100→10: 재고 차이 -90', p.ok && p.d===-90 && p.after===5);
  m.logFixApply(list,a,10,p.d,'s1');
  t('고친 기록: 수량 10, 후 10', a.amount===10 && a.qtyAfter===10 && a.qtyBefore===0);
  t('뒤 기록 전·후도 같이 밀린다(100→10, 95→5)', b.qtyBefore===10 && b.qtyAfter===5);
  t('고친 전·후가 기록 안에 남는다', a.edits.length===1 && a.edits[0].from===100 && a.edits[0].to===10);
}
{ const {a,b,list}=mk();
  const p=m.logFixPlan(list,b,0,95);
  t('출고 5→0 (잘못 넣은 기록 취소): 재고 +5', p.ok && p.d===5 && p.after===100);
}
{ const {a,list}=mk();
  const p=m.logFixPlan(list,a,1,95);
  t('고친 뒤 재고가 0 밑이면 막는다', !p.ok && /재고가 -4/.test(p.why));
  t('음수 수량은 막는다', !m.logFixPlan(list,a,-3,95).ok);
  t('숫자가 아니면 막는다', !m.logFixPlan(list,a,NaN,95).ok);
}
{ const {a,b}=mk();
  const c={id:'c',type:'count',amount:3,qtyBefore:95,qtyAfter:92,at:'2026-11-09T09:45:00'};
  t('뒤에 재고 세기가 있으면 막는다', !m.logFixPlan([c,b,a],a,10,92).ok);
  const c0={...c, at:'2026-11-09T08:00:00'};
  t('세기가 앞에 있으면 고칠 수 있다', m.logFixPlan([b,a,c0],a,10,95).ok);
}
// 출고가 0 밑으로 잘렸던 기록: 3개 있는데 5개 출고 → 실제로 움직인 몫은 -3
{ const l={id:'x',type:'out',amount:5,qtyBefore:3,qtyAfter:0,at:'2026-11-09T09:00:00'};
  const p=m.logFixPlan([l],l,3,0);
  t('잘렸던 출고 5→3: 재고는 그대로(실제로 3개만 빠졌다)', p.ok && p.d===0 && p.after===0);
}
// 임플란트 기록 모양(before·after)
{ const l={id:'i',pid:'p',vid:'v',type:'out',cat:'normal',amount:2,before:10,after:8,memo:'',at:'2026-11-09T09:00:00'};
  const p=m.logFixPlan([l],l,1,8);
  t('임플란트 사용 2→1: 현재고 +1', p.ok && p.d===1 && p.after===9);
  m.logFixApply([l],l,1,p.d,'u');
  t('임플란트 기록 후 칸이 고쳐진다', l.after===9 && l.amount===1);
  t('손으로 넣은 입고·사용만 고친다', m.ivFixable(l) && !m.ivFixable({...l,memo:'케이스 ...'}) && !m.ivFixable({...l,type:'adjust'}));
  t('규격 처음 만들 때 넣은 "초기 등록" 입고도 고친다', m.ivFixable({...l,type:'in',memo:'초기 등록'}) && !m.ivFixable({...l,type:'in',memo:'거래명세서 · A'}));
}
// 권한
{ const l={type:'in',by:'s1',at:'2026-11-09T09:00:00'};
  const today='2026-11-09';
  t('원장은 언제든', m.logFixCan(l,{id:'o',role:'owner'},today) && m.logFixCan({...l,by:''},{id:'o',role:'owner'},'2026-12-01'));
  t('인사담당자도 언제든', m.logFixCan({...l,by:'zz'},{id:'h',role:'hr'},today));
  t('직원은 자기가 오늘 넣은 것', m.logFixCan(l,{id:'s1',role:'staff'},today));
  t('직원: 남이 넣은 것은 안 된다', !m.logFixCan(l,{id:'s2',role:'staff'},today));
  t('직원: 지난날 것은 안 된다', !m.logFixCan(l,{id:'s1',role:'staff'},'2026-11-10'));
  t('직원: 누가 넣었는지 모르는 옛 기록은 안 된다', !m.logFixCan({...l,by:undefined},{id:'s1',role:'staff'},today));
  t('세기 기록은 고치기 대상이 아니다', !m.logFixCan({...l,type:'count'},{id:'o',role:'owner'},today));
  t('로그인 안 했으면 안 된다', !m.logFixCan(l,null,today));
}
// 교육 계획서 자리
{ m.setDB({}); m.eduInit(); const D=m.getDB();
  t('교육 계획서 자리가 생긴다', D.edu && typeof D.edu.plans==='object' && !Array.isArray(D.edu.plans));
  m.setDB({edu:{kind:'clinic',items:{},recs:[],plans:{fire:{date:'2026-11-14'}}}}); m.eduInit();
  t('있던 계획서는 그대로 둔다', m.getDB().edu.plans.fire.date==='2026-11-14');
}
t('소방훈련 교육 내용(소화·통보·피난)이 목록에 있다', /id:'fire'[^\n]*\n[^\n]*topics:'소화 훈련[^']*통보 훈련[^']*피난 훈련/.test(js));
t('화면 문구에 "손으로 고침"이 없다', !/손으로 고침/.test(html));

console.log(`\n${pass} 통과 / ${fail} 실패\n`);
if(fail) process.exit(1);
