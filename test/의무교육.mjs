/* 의무교육 시험 — index.html 에서 교육 목록·상태 계산 함수를 그대로 떼어 와 돌린다.

   무엇을 보나: 의원급과 병원급에서 해당 교육이 갈리는지, 이수 기록으로 미이수·기한 지남이 맞게 나오는지,
   기록이 하나도 없으면 미이수로 몰지 않는지, 근거 문서와 어긋난 주기가 목록에 들어오지 않았는지.
   돌리는 법:  node test/의무교육.mjs        (설치 필요 없음) */
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
const names = ['eduCatalog','eduInit','eduCtx','eduState','eduLast','eduDue','eduStatus','eduItems','eduProblemCount','eduConfMake','eduConfOf','eduConfDone','eduConfText'];
const make = (staff, now)=>{
  const ctx = { DB:{ edu:null, staff }, DAY_MS:86400000, now };
  const src = `
    const DAY_MS=ctx.DAY_MS; let DB=ctx.DB;
    const staffCount=()=>DB.staff.filter(s=>s.active!==false).length;
    const activeStaff=()=>DB.staff.filter(s=>s.active!==false);
    const staffById=id=>DB.staff.find(s=>s.id===id);
    const staffLabel=id=>(staffById(id)||{}).name||'';
    const pad=n=>String(n).padStart(2,'0');
    const now=()=>new Date(ctx.now).toISOString();
    const fmtTime=iso=>{const d=new Date(iso);return pad(d.getHours())+':'+pad(d.getMinutes());};
    const todayKey=(d=new Date(ctx.now))=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
    ${names.map(grab).join('\n')}
    return {DB, ${names.join(',')}};`;
  return new Function('ctx', src)(ctx);
};

let pass=0, fail=0;
const t=(이름, 참)=>{ if(참){pass++;console.log('  통과 · '+이름);} else {fail++;console.log('  실패 · '+이름);} };
const S=[{id:'a',name:'김원장'},{id:'b',name:'이위생'},{id:'c',name:'박조무'}];
const NOW = new Date('2026-10-07T12:00:00');

// 1) 목록
{ const m=make(S, NOW); const cat=m.eduCatalog();
  t('교육 id 가 겹치지 않는다', new Set(cat.map(x=>x.id)).size===cat.length);
  t('모든 교육에 근거 조문이 있다', cat.every(x=>x.cite && x.name));
  t('과태료 금액이 화면 문구에 없다', !cat.some(x=>/\d+\s*만\s*원/.test([x.note,x.keep,x.name].join(' '))));
  t('링크는 https 만', cat.every(x=>x.links.every(l=>/^https:\/\//.test(l.u))));
  t('방사선 보수는 3년째 해 말 규칙', cat.find(x=>x.id==='radiation').dueRule==='yearEnd3');
  t('교육 아닌 의무는 따로 묶인다', cat.find(x=>x.id==='tbcheck').g==='duty');
}

// 2) 의원급 / 병원급
{ const m=make(S, NOW); m.eduInit();
  const on=()=>m.eduItems().map(x=>x.id);
  t('의원급 30인 미만: 성희롱·장애인·개인정보·학대 계열이 기본 켜짐',
    ['sexh','disab','priv','child','elder','dabuse','urgent','tb','infect','hand','dentist','hygiene','waste','tbcheck'].every(id=>on().includes(id)));
  t('의원급 50인 미만: 산업안전 정기교육은 적용 제외', !on().includes('safety'));
  t('의원급: 자살예방·폭력예방은 해당 없음', !on().includes('suicide') && !on().includes('violence'));
  t('의원급: 퇴직연금·세탁물·방사선·마약류는 "해당되면 켜세요"(기본 꺼짐)',
    ['pension','laundry','radiation','narcotic'].every(id=>!on().includes(id) && m.eduState(m.eduCatalog().find(x=>x.id===id)).st==='maybe'));
  m.DB.edu.kind='hospital';
  t('병원급: 산업안전·자살예방이 기본 켜짐', on().includes('safety') && on().includes('suicide'));
  t('병원급 병상 수 없음: 폭력예방은 "해당되면 켜세요"', !on().includes('violence') && m.eduState(m.eduCatalog().find(x=>x.id==='violence')).st==='maybe');
  m.DB.edu.beds=120; t('병원급 120병상: 폭력예방이 켜짐', on().includes('violence'));
  m.DB.edu.beds=50;  t('병원급 50병상: 폭력예방은 해당 없음', m.eduState(m.eduCatalog().find(x=>x.id==='violence')).st==='no');
  m.DB.edu.kind='clinic'; m.DB.staff=Array.from({length:55},(_, i)=>({id:'s'+i,name:'직원'+i}));
  t('의원급이라도 직원 50명 이상이면 산업안전이 켜짐', on().includes('safety'));
}

// 3) 기록과 기한
{ const m=make(S, NOW); m.eduInit(); const it=m.eduCatalog().find(x=>x.id==='sexh');
  t('기록이 하나도 없으면 미이수로 몰지 않는다(none)', m.eduStatus(it).level==='none');
  t('기록이 없으면 챙길 개수는 0', m.eduProblemCount()===0);
  m.DB.edu.recs.push({id:'r1', itemId:'sexh', date:'2026-03-01', staffIds:['a','b']});
  let st=m.eduStatus(it);
  t('기록을 시작하면 빠진 사람이 나온다', st.level==='bad' && st.missing.join()==='박조무');
  t('다음 기한은 1년 뒤', st.next==='2027-03-01');
  m.DB.edu.recs.push({id:'r2', itemId:'sexh', date:'2026-04-01', staffIds:['c']});
  st=m.eduStatus(it); t('모두 이수하면 ok', st.level==='ok' && st.missing.length===0);
  m.DB.edu.recs.push({id:'r3', itemId:'sexh', date:'2025-06-01', staffIds:['a']}); // 더 옛 기록은 최근 기록을 못 이긴다
  t('같은 사람의 가장 최근 이수일을 쓴다', m.eduLast('sexh','a')==='2026-03-01');
  const old=make(S, NOW); old.eduInit(); old.DB.edu.recs.push({id:'x', itemId:'sexh', date:'2025-01-10', staffIds:['a','b','c']});
  const st2=old.eduStatus(old.eduCatalog().find(x=>x.id==='sexh'));
  t('1년이 지나면 기한 지남', st2.level==='bad' && st2.overdue.length===3);
  const soon=make(S, NOW); soon.eduInit(); soon.DB.edu.recs.push({id:'y', itemId:'sexh', date:'2025-11-20', staffIds:['a','b','c']});
  t('60일 안에 기한이면 warn', soon.eduStatus(soon.eduCatalog().find(x=>x.id==='sexh')).level==='warn');
}

// 4) 주기 규칙
{ const m=make(S, NOW); m.eduInit();
  const rad=m.eduCatalog().find(x=>x.id==='radiation');
  t('방사선 보수교육 기한은 3년째 되는 해 12월 31일', m.eduDue(rad,'2024-05-20',36)==='2027-12-31');
  const nar=m.eduCatalog().find(x=>x.id==='narcotic');
  t('주기가 없는 교육(마약류 1회)은 기한이 없다', m.eduDue(nar,'2024-05-20',0)==='');
  m.DB.edu.items.tb={cycle:24};
  t('병원이 정한 주기가 목록 기본값을 이긴다', m.eduState(m.eduCatalog().find(x=>x.id==='tb')).cyc===24);
  const st=make(S, NOW); st.eduInit(); st.DB.edu.items.dentist={on:true};
  st.DB.edu.recs.push({id:'p', itemId:'dentist', date:'2025-01-01', staffIds:['a']});
  const ds=st.eduStatus(st.eduCatalog().find(x=>x.id==='dentist'));
  t('한 사람이 받는 교육은 기록된 사람만 본다(다른 직원을 미이수로 몰지 않음)', ds.people.length===1 && ds.missing.length===0 && ds.overdue.join()==='김원장');
}

// 5) 참석 확인 — 손서명 대신 남기는 기록
{ const m=make(S, NOW); m.eduInit();
  const r={id:'r', itemId:'sexh', date:'2026-10-07', staffIds:['a','b','c']};
  t('확인 전에는 아무도 확인되지 않았다', m.eduConfDone(r)===0 && m.eduConfText(m.eduConfOf(r,'a'))==='');
  r.conf={}; r.conf.a=m.eduConfMake('pin', S[0]);
  t('본인 PIN 확인은 방법이 pin 으로 남는다', r.conf.a.by==='pin' && m.eduConfText(r.conf.a).startsWith('✓ 본인 확인 2026-10-07'));
  r.conf.b=m.eduConfMake('mgr', {id:'sil', name:'이실장'});
  t('담당자 확인은 담당자 이름이 남는다', r.conf.b.by==='mgr' && m.eduConfText(r.conf.b).includes('담당자 확인(이실장)'));
  t('확인한 사람 수를 센다', m.eduConfDone(r)===2);
  t('확인 기록이 없는 사람은 빈 문자열(손서명용 빈칸)', m.eduConfText(m.eduConfOf(r,'c'))==='');
}

console.log(`\n${pass} 통과 / ${fail} 실패`);
process.exit(fail?1:0);
