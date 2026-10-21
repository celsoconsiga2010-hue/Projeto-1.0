'use strict';
/* ============ ciclos de treino, atividades extras e gerador ============
   Tudo aqui é novo e usa só as tabelas training_cycles e extra_activities.
   Nenhum treino, exercício ou sessão existente é alterado por este arquivo. */
const EXTRA_TYPES=['Futebol','Futevôlei','Canoagem','Corrida','Ciclismo','Natação','Lutas','Caminhada','Funcional','Outra'];
const dd=(a,b)=>Math.round((parseYmd(a)-parseYmd(b))/864e5);
const activeCycle=()=>S.cycles.find(c=>c.status==='ativo')||null;
const closedCycles=()=>S.cycles.filter(c=>c.status==='concluido').sort((a,b)=>String(b.endDate).localeCompare(String(a.endDate)));
const pendingClose=()=>{if(activeCycle())return null;const l=closedCycles()[0];return l&&!l.handled?l:null};
async function reloadCycles(){S.cycles=await api.loadCycles();cacheNow()}
async function reloadExtras(){S.extras=await api.loadExtras();cacheNow()}
const DONE_LABEL={manual:'Concluído manualmente','auto-sessoes':'Concluído ao atingir as sessões','auto-prazo':'Encerrado ao fim do prazo'};
const extrasIn=(from,to)=>S.extras.filter(x=>x.date>=from&&x.date<=to);
function claimedIds(){const s=new Set();S.cycles.forEach(c=>{if(c.status==='concluido')((c.summary&&c.summary.sessionIds)||[]).forEach(i=>s.add(i))});return s}
function cycleSessions(c){
  if(c.status==='concluido'){const ids=new Set((c.summary&&c.summary.sessionIds)||[]);return finished().filter(s=>ids.has(s.id))}
  const claimed=claimedIds(),ids=c.workoutIds||[];
  return finished().filter(s=>s.date>=c.startDate&&ids.includes(s.workoutId)&&!claimed.has(s.id));
}
function cycleStats(c){
  const N=(c.workoutIds||[]).length||1,total=c.totalSessions,list=cycleSessions(c),done=list.length,pending=Math.max(0,total-done),today=todayStr();
  const daysLeft=dd(c.deadline,today),dpw=c.daysPerWeek||3;
  const need=pending===0?0:(daysLeft>0?pending/(daysLeft/7):Infinity);
  const needCeil=pending===0?0:(isFinite(need)?Math.ceil(need-1e-9):Infinity);
  const fDays=pending===0?0:Math.ceil(pending/dpw*7);
  const forecast=ymd(addDays(parseYmd(today),fDays));
  const late=pending>0&&forecast>c.deadline;
  const elapsed=Math.max(1,dd(today,c.startDate)+1);
  const pace=done>=2&&elapsed>=7?done/(elapsed/7):null;
  return {N:N,total:total,list:list,done:done,pending:pending,daysLeft:daysLeft,need:need,needCeil:needCeil,forecast:forecast,late:late,lateDays:late?dd(forecast,c.deadline):0,pace:pace,
    next:(c.workoutIds||[])[done%N],pct:total?Math.min(100,done/total*100):0,round:Math.min(c.rounds||1,Math.floor(done/N)+1),dpw:dpw};
}
const snapOne=w=>({id:w.id,name:w.name,exercises:(w.exercises||[]).map(e=>({exerciseId:e.exerciseId,name:e.name,group:e.group||'',sets:e.sets,repMin:e.repMin,repMax:e.repMax,load:e.load==null?'':e.load}))});
function snapFor(ids,old){return ids.map(id=>{const w=S.workouts.find(x=>x.id===id);if(w)return snapOne(w);return (old||[]).find(x=>x.id===id)}).filter(Boolean)}
const wNameIn=(c,id)=>{const w=S.workouts.find(x=>x.id===id)||(c.workouts||[]).find(x=>x.id===id);return w?w.name:'Treino removido'};
function progBar(p){return '<div class="prog" role="progressbar" aria-valuenow="'+Math.round(p)+'" aria-valuemin="0" aria-valuemax="100"><span style="width:'+p.toFixed(1)+'%"></span></div>'}
const needTxt=st=>st.pending===0?'0':(!isFinite(st.needCeil)||st.needCeil>7?'7+':String(st.needCeil));

async function closeCycle(c,mode){
  if(S.closing[c.id])return;S.closing[c.id]=true;
  const st=cycleStats(c),today=todayStr(),sess=st.list,ex=new Map();
  sess.forEach(s=>(s.exercises||[]).forEach(e=>{if(!ex.has(e.exerciseId))ex.set(e.exerciseId,{exerciseId:e.exerciseId,name:e.name,group:e.group||''})}));
  const xs=extrasIn(c.startDate,today),byType={};
  xs.forEach(x=>{const b=byType[x.type]=byType[x.type]||{n:0,min:0};b.n++;b.min+=x.durationMin||0});
  const summary={sessionIds:sess.map(s=>s.id),sessionsDone:sess.length,volume:sess.reduce((a,s)=>a+sesVolume(s),0),
    durationSec:sess.reduce((a,s)=>a+(s.durationSec||0),0),exercises:Array.from(ex.values()),extrasCount:xs.length,
    extrasMinutes:xs.reduce((a,x)=>a+(x.durationMin||0),0),extrasByType:byType,weeks:Math.max(1,Math.round((dd(today,c.startDate)+1)/7*10)/10)};
  const ok=await safe(async()=>{await api.updateCycle(c.id,{status:'concluido',endDate:today,completion:mode,summary:summary,workouts:snapFor(c.workoutIds||[],c.workouts),handled:false});await reloadCycles()});
  delete S.closing[c.id];
  if(ok){if(mode!=='manual')toast('Ciclo concluído. Veja as opções na aba Ciclo.');softRender()}
}
function autoCheck(){
  if(S.boot!=='ready'||S.offlineData||!navigator.onLine||!S.cyclesReady)return;
  const c=activeCycle();if(!c||c.autoClose===false)return;
  const st=cycleStats(c);
  if(st.pending===0)closeCycle(c,'auto-sessoes');else if(todayStr()>c.deadline)closeCycle(c,'auto-prazo');
}
function suggestRounds(cy){const N=cy.workoutIds.length||1,from=cy.startDate>todayStr()?cy.startDate:todayStr(),days=Math.max(0,dd(cy.deadline,from));return Math.max(1,Math.floor(days/7*(Math.round(num(cy.dpw))||3)/N))}
function newCycleDraft(ids){
  const cy={mode:'new',name:'Ciclo '+(S.cycles.length+1),workoutIds:ids||(S.workouts.length<=6?S.workouts.map(w=>w.id):[]),rounds:4,startDate:todayStr(),deadline:ymd(addDays(new Date(),56)),dpw:3,auto:true};
  cy.rounds=suggestRounds(cy);return cy;
}
function cyDraftStats(cy){
  const ids=cy.workoutIds,rounds=Math.round(num(cy.rounds));
  if(!ids.length||rounds<1||!cy.deadline||!cy.startDate)return null;
  return cycleStats({id:'_draft',workoutIds:ids,totalSessions:ids.length*rounds,deadline:cy.deadline,daysPerWeek:Math.round(num(cy.dpw))||3,startDate:cy.startDate,status:'ativo',rounds:rounds});
}
function cyPreview(){
  const cy=S.draft.cy,st=cyDraftStats(cy);
  if(!st)return '<p class="hint">Escolha os treinos da sequência e informe as voltas e as datas para ver o cálculo.</p>';
  const sug=suggestRounds(cy),cur=Math.round(num(cy.rounds));
  let msg;
  if(cy.deadline<=todayStr())msg='<p class="err">A data-limite precisa ser depois de hoje.</p>';
  else if(st.pending===0)msg='<p class="err">Já existem sessões suficientes desde a data de início. Aumente as voltas ou use um início mais recente.</p>';
  else if(st.late)msg='<p class="warn-t">Com '+st.dpw+' dia(s) por semana o ciclo termina cerca de '+st.lateDays+' dia(s) depois do prazo. Aumente os dias de treino ou o prazo.</p>';
  else msg='<p class="up">Dentro do prazo com a disponibilidade informada.</p>';
  return '<div class="stats"><div class="stat"><span class="eyebrow">Total de sessões</span><span class="v">'+st.total+'</span><span class="s">'+st.N+' treino(s) × '+Math.round(num(cy.rounds))+' volta(s)</span></div>'+
   '<div class="stat"><span class="eyebrow">Feitas / pendentes</span><span class="v">'+st.done+'<small>/ '+st.pending+'</small></span></div>'+
   '<div class="stat"><span class="eyebrow">Dias por semana necessários</span><span class="v">'+needTxt(st)+'</span><span class="s">para cumprir o prazo</span></div>'+
   '<div class="stat"><span class="eyebrow">Previsão de conclusão</span><span class="v" style="font-size:26px;line-height:1.1">'+(st.pending?fmtDate(st.forecast):'–')+'</span><span class="s">com '+st.dpw+' dia(s) por semana</span></div></div>'+msg+
   (sug!==cur?'<div class="row"><span class="hint">Pelo prazo e pela disponibilidade cabem cerca de '+sug+' volta(s).</span><button class="btn sm" data-act="cyUseRounds">Usar '+sug+'</button></div>':'');
}
async function saveCycle(){
  const cy=S.draft.cy,rounds=Math.round(num(cy.rounds)),dpw=Math.round(num(cy.dpw))||3,st=cyDraftStats(cy);let e='';
  if(!cy.workoutIds.length)e='Escolha ao menos um treino para a sequência.';
  else if(rounds<1||rounds>52)e='As voltas completas vão de 1 a 52.';
  else if(!cy.startDate)e='Informe a data de início.';
  else if(!cy.deadline||cy.deadline<=todayStr())e='A data-limite precisa ser depois de hoje.';
  else if(cy.deadline<=cy.startDate)e='A data-limite precisa ser depois do início.';
  else if(cy.mode!=='edit'&&activeCycle())e='Já existe um ciclo em andamento. Conclua-o antes de criar outro.';
  else if(st&&st.pending===0)e='Já existem sessões suficientes desde a data de início. Aumente as voltas ou use um início mais recente.';
  if(e){S.ui.cyErr=e;render();return}
  const old=cy.mode==='edit'?S.cycles.find(c=>c.id===cy.editId):null;
  const rec={name:(cy.name||'').trim()||'Ciclo',workoutIds:cy.workoutIds.slice(),rounds:rounds,totalSessions:cy.workoutIds.length*rounds,startDate:cy.startDate,deadline:cy.deadline,daysPerWeek:dpw,autoClose:cy.auto!==false,workouts:snapFor(cy.workoutIds,old&&old.workouts)};
  try{
    if(cy.mode==='edit')await api.updateCycle(cy.editId,rec);
    else{await api.insertCycle(Object.assign({},rec,{status:'ativo',renewOf:cy.renewOf||null}));
      if(cy.renewOf)await api.updateCycle(cy.renewOf,{handled:true})}
    await reloadCycles();
  }catch(e){S.ui.cyErr=e&&e.code==='23505'?'Já existe um ciclo em andamento. Conclua-o antes de criar outro.':errMsg(e);render();return}
  S.ui.cyErr='';S.seg.cycle='atual';S.draft=null;toast(cy.mode==='edit'?'Ciclo atualizado.':'Ciclo iniciado.');go('cycle',{tab:'cycle'})
}

/* ---- atividades extras ---- */
function weekMinutes(xs,n){
  const wk=weekStart(new Date()),items=[];
  for(let i=n-1;i>=0;i--){const a=addDays(wk,-7*i),b=addDays(a,6),k=ymd(a),e=ymd(b),w=xs.filter(x=>x.date>=k&&x.date<=e);
    items.push({label:fmtShort(k),v:w.reduce((s,x)=>s+(x.durationMin||0),0),tip:'Semana de '+fmtShort(k)+': '+w.length+' atividade(s), '+w.reduce((s,x)=>s+(x.durationMin||0),0)+' min'})}
  return items;
}
function extraRow(x,del){
  return '<div class="li"><span class="grow"><span class="t">'+esc(x.type)+'</span><span class="muted small">'+fmtDate(x.date)+' · '+x.durationMin+' min'+(x.notes?' · '+esc(x.notes):'')+'</span></span>'+
   (del?(S.ui.delX===x.id?'<span class="row" style="flex:none"><button class="btn danger fill sm" data-act="delExtra" data-id="'+esc(x.id)+'">Excluir</button><button class="btn sm" data-act="cancelDel">Cancelar</button></span>':'<button class="btn sm icon ghost danger" aria-label="Excluir atividade" data-act="askDelX" data-id="'+esc(x.id)+'">'+ic('trash','sm')+'</button>'):'')+'</div>';
}
function vExtras(){
  const F=S.ui.xf=S.ui.xf||{type:'Futebol',custom:'',date:todayStr(),min:'60',notes:'',err:''};
  const wk=ymd(weekStart(new Date())),thisW=S.extras.filter(x=>x.date>=wk),d30=extrasIn(ymd(addDays(new Date(),-29)),todayStr()),d90=extrasIn(ymd(addDays(new Date(),-89)),todayStr());
  const mins=a=>a.reduce((s,x)=>s+(x.durationMin||0),0),byT=new Map();
  d90.forEach(x=>{const c=byT.get(x.type)||{n:0,m:0};c.n++;c.m+=x.durationMin||0;byT.set(x.type,c)});
  const bars=Array.from(byT.entries()).map(a=>({label:a[0]+' ('+a[1].n+'x)',v:a[1].m})).sort((a,b)=>b.v-a.v);
  const recent=S.extras.slice(0,30);
  return '<section class="card"><h3>Registrar atividade</h3><p class="muted small">Futebol, corrida, natação ou qualquer outra atividade da semana. Ela entra no histórico junto com os treinos.</p>'+
   '<div class="formgrid"><div class="field"><label for="xfType">Modalidade</label><select id="xfType" class="in" data-chg="xfSel">'+opts(EXTRA_TYPES,F.type)+'</select></div>'+
   (F.type==='Outra'?'<div class="field"><label for="xfCustom">Qual atividade?</label><input id="xfCustom" class="in" data-scope="xf" data-f="custom" value="'+esc(F.custom)+'"></div>':'')+
   '<div class="field"><label for="xfDate">Data</label><input id="xfDate" type="date" class="in" data-scope="xf" data-f="date" value="'+esc(F.date)+'"></div>'+
   '<div class="field"><label for="xfMin">Duração (minutos)</label><input id="xfMin" class="in" inputmode="numeric" data-scope="xf" data-f="min" value="'+esc(F.min)+'"></div></div>'+
   '<div class="field"><label for="xfNotes">Observações (opcional)</label><input id="xfNotes" class="in" data-scope="xf" data-f="notes" value="'+esc(F.notes)+'"></div>'+
   (F.err?'<p class="err" role="alert">'+esc(F.err)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="saveExtra">'+ic('plus','sm')+' Registrar</button></div></section>'+
   '<div class="stats"><div class="stat"><span class="eyebrow">Na semana</span><span class="v">'+thisW.length+'<small>atividades</small></span><span class="s">'+mins(thisW)+' min</span></div>'+
   '<div class="stat"><span class="eyebrow">Últimos 30 dias</span><span class="v">'+d30.length+'<small>atividades</small></span><span class="s">'+mins(d30)+' min no total</span></div>'+
   '<div class="stat"><span class="eyebrow">Frequência média</span><span class="v">'+fmt(d30.length/(30/7),1)+'<small>por semana</small></span><span class="s">nos últimos 30 dias</span></div></div>'+
   '<div class="grid2"><section class="card"><h3>Minutos por semana</h3>'+barChart(weekMinutes(S.extras,8),{label:'Minutos de atividades extras por semana',alt:true,half:true})+'</section>'+
   '<section class="card"><h3>Por modalidade</h3><p class="muted small" style="margin-top:-6px">Minutos nos últimos 90 dias</p>'+hbars(bars,'min')+'</section></div>'+
   '<section class="card"><h3>Registros recentes</h3>'+(recent.length?'<div class="list">'+recent.map(x=>extraRow(x,true)).join('')+'</div>':'<p class="muted">Nenhuma atividade registrada ainda.</p>')+'</section>';
}
async function saveExtra(){
  const F=S.ui.xf,min=Math.round(num(F.min));
  let type=F.type==='Outra'?((F.custom||'').trim()||'Outra'):F.type,e='';
  if(!F.date)e='Informe a data.';else if(F.date>todayStr())e='A data não pode ser no futuro.';else if(min<1||min>600)e='Informe a duração entre 1 e 600 minutos.';
  if(e){F.err=e;render();return}
  F.err='';
  if(await safe(async()=>{await api.insertExtra({type:type,date:F.date,durationMin:min,notes:(F.notes||'').trim()});await reloadExtras()},'Atividade registrada.')){F.notes='';render()}
}
function extrasHistCard(H){
  const xs=S.extras.filter(x=>inPeriod(x.date,H));if(!xs.length)return '';
  return '<section class="card"><div class="row between"><h3>Atividades extras no período</h3><span class="muted small tn">'+xs.length+' · '+xs.reduce((a,x)=>a+(x.durationMin||0),0)+' min</span></div><div class="list">'+xs.slice(0,30).map(x=>extraRow(x,false)).join('')+'</div></section>';
}

/* ---- gerador automático de treinos ---- */
const GEN_GOALS=['Hipertrofia','Força','Emagrecimento','Condicionamento'];
const GEN_ORDER=['Peito','Tríceps','Costas','Bíceps','Ombros','Antebraço','Quadríceps','Posterior de coxa','Glúteos','Panturrilha','Abdômen','Corpo inteiro'];
const GEN_ISO=['Bíceps','Tríceps','Antebraço','Panturrilha','Abdômen'];
const GEN_P={
  'Hipertrofia':{s1:4,s2:3,min:8,max:12,rest:75},
  'Força':{s1:5,s2:4,min:3,max:6,rest:120},
  'Emagrecimento':{s1:3,s2:3,min:12,max:15,rest:45},
  'Condicionamento':{s1:3,s2:3,min:15,max:20,rest:40}
};
const GEN_TPL={
  1:[['Peito','Costas','Ombros','Quadríceps','Abdômen']],
  2:[['Peito','Costas','Ombros','Bíceps','Tríceps'],['Quadríceps','Posterior de coxa','Glúteos','Panturrilha','Abdômen']],
  3:[['Peito','Ombros','Tríceps'],['Costas','Bíceps','Abdômen'],['Quadríceps','Posterior de coxa','Glúteos','Panturrilha']],
  4:[['Peito','Tríceps'],['Costas','Bíceps'],['Quadríceps','Glúteos','Panturrilha'],['Ombros','Posterior de coxa','Abdômen']],
  5:[['Peito','Tríceps'],['Costas','Bíceps'],['Quadríceps','Panturrilha'],['Ombros','Abdômen'],['Posterior de coxa','Glúteos']],
  6:[['Peito','Tríceps'],['Costas','Bíceps'],['Quadríceps','Panturrilha'],['Ombros','Abdômen'],['Posterior de coxa','Glúteos'],['Corpo inteiro','Abdômen']]
};
function genSplit(g){
  if(!g.muscles.length)return GEN_TPL[Math.max(1,Math.min(6,g.days))].map(a=>a.slice());
  const gr=GEN_ORDER.filter(x=>g.muscles.includes(x)),k=Math.min(g.days,gr.length),out=[];
  for(let i=0;i<k;i++)out.push(gr.slice(Math.floor(i*gr.length/k),Math.floor((i+1)*gr.length/k)));
  return out;
}
function genPick(group,k,seed,si,used){
  const pool=allEx().filter(e=>e.group===group);if(!pool.length||k<1)return [];
  const off=(seed*k+(group==='Corpo inteiro'?si:0))%pool.length,ord=pool.slice(off).concat(pool.slice(0,off));
  return ord.filter(e=>!used.has(e.id)).slice(0,k);
}
function genEx(e,P,first){
  const iso=P===GEN_P['Força']&&GEN_ISO.includes(e.group);
  return {exerciseId:e.id,name:e.name,group:e.group,sets:iso?3:(first?P.s1:P.s2),repMin:iso?8:P.min,repMax:iso?12:P.max,load:'',rest:P.rest,inc:2.5,notes:''};
}
const genMin=exs=>Math.round(5+exs.reduce((a,e)=>a+e.sets*((e.rest+45)/60)+1.5,0));
function genPlan(g){
  const P=GEN_P[g.goal]||GEN_P['Hipertrofia'],split=genSplit(g),fin=(g.goal==='Emagrecimento'||g.goal==='Condicionamento');
  const perEx=P.s2*((P.rest+45)/60)+1.5,count=Math.max(3,Math.min(9,Math.floor(Math.max(10,g.minutes-5)/perEx)));
  return split.map((groups,si)=>{
    const hasFull=groups.includes('Corpo inteiro'),useFin=fin&&!hasFull&&count>=4,n=count-(useFin?1:0),used=new Set(),exs=[];let note='';
    let gs=groups;if(n<gs.length){note='Tempo curto: '+(gs.length-n)+' grupo(s) ficaram de fora desta sessão.';gs=gs.slice(0,n)}
    const base=Math.floor(n/gs.length),extra=n%gs.length;
    gs.forEach((gr,i)=>{genPick(gr,base+(i<extra?1:0),g.seed,si,used).forEach(e=>{used.add(e.id);exs.push(genEx(e,P,exs.length===0))})});
    if(useFin)genPick('Corpo inteiro',1,g.seed,si,used).forEach(e=>exs.push(genEx(e,P,false)));
    return {name:'ABCDEF'[si]+' · '+groups.slice(0,3).join(' + '),groups:groups,exercises:exs,est:genMin(exs),note:note};
  });
}
function genDraft(o){
  o=o||{};const p=S.profile||{};
  return {goal:GEN_GOALS.includes(p.goal)?p.goal:'Hipertrofia',muscles:[],days:Math.max(1,Math.min(6,Math.round(num(p.weekGoal))||3)),minutes:60,seed:0,plan:null,createCycle:!activeCycle()||!!o.renewOf,renewOf:o.renewOf||null};
}
function vGen(){
  const g=S.draft.gen;
  const form='<section class="card"><p class="muted">Responda quatro perguntas e o app monta a rotina. Depois você ajusta o que quiser. Seus treinos atuais não são alterados.</p>'+
   '<div class="field"><span class="lab">Objetivo</span><div class="chips">'+GEN_GOALS.map(x=>'<button class="chip'+(g.goal===x?' on':'')+'" aria-pressed="'+(g.goal===x)+'" data-act="genGoal" data-v="'+x+'">'+x+'</button>').join('')+'</div></div>'+
   '<div class="field"><span class="lab">Grupos musculares (deixe vazio para o corpo todo)</span><div class="chips">'+GEN_ORDER.filter(x=>x!=='Corpo inteiro').map(x=>'<button class="chip'+(g.muscles.includes(x)?' on':'')+'" aria-pressed="'+g.muscles.includes(x)+'" data-act="genMuscle" data-v="'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div></div>'+
   '<div class="formgrid"><div class="field"><label for="gnDays">Dias de treino por semana</label><select id="gnDays" class="in" data-chg="genF" data-f="days">'+opts([1,2,3,4,5,6].map(n=>[n,n+(n===1?' dia':' dias')]),g.days)+'</select></div>'+
   '<div class="field"><label for="gnMin">Tempo por sessão</label><select id="gnMin" class="in" data-chg="genF" data-f="minutes">'+opts([30,45,60,75,90].map(n=>[n,n+' min']),g.minutes)+'</select></div></div>'+
   '<div class="row"><button class="btn primary" data-act="genMake">'+(g.plan?'Gerar de novo com estas opções':'Gerar treino')+'</button></div></section>';
  let prev='';
  if(g.plan){
    prev=g.plan.map((w,wi)=>'<section class="card"><div class="row between"><div class="grow"><h3>'+esc(w.name)+'</h3><p class="muted small">'+w.exercises.length+' exercícios · cerca de '+w.est+' min</p></div></div>'+(w.note?'<p class="warn-t small">'+esc(w.note)+'</p>':'')+
     (w.exercises.length?'<div class="list">'+w.exercises.map((e,i)=>'<div class="li" style="padding:8px 2px"><span class="grow"><span class="t" style="font-weight:500">'+esc(e.name)+'</span><span class="muted small">'+esc(e.group)+' · '+e.sets+' × '+e.repMin+'–'+e.repMax+' · descanso '+e.rest+' s</span></span><button class="btn sm icon" aria-label="Trocar '+esc(e.name)+'" data-act="genSwap" data-w="'+wi+'" data-i="'+i+'">'+ic('copy','sm')+'</button><button class="btn sm icon ghost danger" aria-label="Remover '+esc(e.name)+'" data-act="genRm" data-w="'+wi+'" data-i="'+i+'">'+ic('x','sm')+'</button></div>').join('')+'</div>':'<p class="muted">Sem exercícios.</p>')+'</section>').join('')+
     '<section class="card"><p class="hint">Use trocar para pedir outro exercício do mesmo grupo e remover para tirar da lista. Depois de salvar, o editor de treinos permite adicionar e reordenar.</p>'+
     '<div class="row"><button class="chip'+(g.createCycle?' on':'')+'" aria-pressed="'+g.createCycle+'" data-act="genCycleToggle">Definir prazo e criar um ciclo com este treino</button></div>'+
     (S.ui.genErr?'<p class="err" role="alert">'+esc(S.ui.genErr)+'</p>':'')+
     '<div class="row"><button class="btn primary" data-act="genSave">Salvar treinos</button><button class="btn" data-act="genAgain">Sugerir outra variação</button></div></section>';
  }
  return '<div class="stack"><div class="pagehead"><div class="row"><button class="btn icon" aria-label="Voltar" data-act="cancelGen">'+ic('back')+'</button><h1>Gerar treino</h1></div></div>'+form+prev+'</div>';
}
async function genSave(){
  const g=S.draft.gen,plan=g.plan.filter(w=>w.exercises.length);
  if(!plan.length){S.ui.genErr='Nenhum treino com exercícios para salvar.';render();return}
  const ids=[],names=new Set(S.workouts.map(w=>w.name));
  try{
    for(const w of plan){
      const nm=(names.has(w.name)?w.name+' ('+fmtShort(todayStr())+')':w.name).slice(0,80);
      const id=await api.saveWorkout({name:nm,description:'Gerado automaticamente: '+g.goal+', '+g.days+' dia(s) por semana, cerca de '+g.minutes+' min por sessão.',goal:g.goal,muscles:w.groups,notes:'',exercises:w.exercises.map(exPayload)});
      ids.push(id);names.add(nm);
    }
    await reloadWorkouts();
  }catch(e){S.ui.genErr=errMsg(e)+(ids.length?' Os treinos já salvos continuam em Meus treinos.':'');try{await reloadWorkouts()}catch(_){}render();return}
  S.ui.genErr='';
  if(g.createCycle&&(!activeCycle()||g.renewOf)){
    const cy=newCycleDraft(ids);cy.dpw=g.days;cy.rounds=suggestRounds(cy);if(g.renewOf){cy.mode='renew';cy.renewOf=g.renewOf}
    S.draft={cy:cy};S.ui.cyErr='';toast('Treinos salvos. Agora defina o prazo do ciclo.');go('cform',{tab:'cycle'});
  }else{S.draft=null;S.seg.workouts='treinos';toast('Treinos salvos em Meus treinos.');go('workouts',{tab:'workouts'})}
}

/* ---- telas do ciclo ---- */
function vCycle(){
  if(!S.cyclesReady)return '<div class="stack"><div class="pagehead"><h1>Ciclo</h1></div><div class="confirm"><b>Falta atualizar o banco de dados</b><span class="small">Rode de novo o arquivo supabase/schema.sql no SQL Editor do Supabase. Ele cria as tabelas de ciclos e atividades extras e não apaga nem altera nada do que já existe. Depois, feche e abra o app.</span></div></div>';
  const cur=S.seg.cycle||'atual';
  return '<div class="stack"><div class="pagehead"><h1>Ciclo</h1></div>'+seg([['atual','Ciclo atual'],['extras','Atividades extras'],['anteriores','Anteriores']],cur,'segC')+(cur==='extras'?vExtras():cur==='anteriores'?vPast():vCurrent())+'</div>';
}
function vCurrent(){
  const pc=pendingClose(),c=activeCycle();
  if(c)return vActive(c);
  if(pc)return vClosedPanel(pc);
  return '<div class="empty"><div><b>Nenhum ciclo em andamento.</b><br>Um ciclo junta a sequência dos seus treinos (A, B, C) com uma data-limite. O app calcula quantas sessões faltam, quantos dias por semana você precisa treinar e quando termina.</div><div class="row">'+(S.workouts.length?'<button class="btn primary" data-act="newCycle">Criar ciclo com meus treinos</button>':'')+'<button class="btn" data-act="genOpen">Gerar treino automático</button></div></div>';
}
function vActive(c){
  const st=cycleStats(c),ids=c.workoutIds||[];
  const per=ids.map((id,i)=>{const n=st.list.filter(s=>s.workoutId===id).length;return '<span class="chip'+(ids[st.done%st.N]===id&&i===st.done%st.N?' on':'')+'" style="display:inline-flex">'+esc(wNameIn(c,id))+' · '+n+'/'+c.rounds+'</span>'});
  const stat=st.pending===0?'<span class="pill ok">Sessões completas</span>':st.late?'<span class="pill bad">Atrasado cerca de '+st.lateDays+' dia(s)</span>':'<span class="pill ok">No prazo</span>';
  const warn=st.pending>0&&isFinite(st.needCeil)&&st.needCeil>st.dpw?'<p class="warn-t small">Você informou '+st.dpw+' dia(s) por semana. Para fechar até '+fmtDate(c.deadline)+' são necessários '+(st.needCeil>7?'mais de 7':st.needCeil)+'.</p>':'';
  const conf=S.ui.confClose?'<div class="confirm"><b>Concluir este ciclo agora?</b><span class="small">'+st.done+' de '+st.total+' sessões feitas. O resumo fica salvo em Anteriores e você escolhe se renova ou gera um novo treino.</span><div class="row"><button class="btn primary" data-act="doClose">Concluir ciclo</button><button class="btn" data-act="cancelClose">Cancelar</button></div></div>':'<div class="row"><button class="btn sm" data-act="editCycle">'+ic('edit','sm')+' Editar prazo</button><button class="btn sm" data-act="askClose">'+ic('check','sm')+' Marcar como concluído</button></div>';
  const xs=extrasIn(c.startDate,todayStr());
  return '<section class="hero"><div class="row between"><div class="eyebrow">Ciclo em andamento</div>'+stat+'</div><h2>'+esc(c.name||'Ciclo')+'</h2>'+
   '<div><div class="row between"><span class="tn"><b>'+st.done+'</b> de '+st.total+' sessões</span><span class="muted small tn">'+st.pending+' pendentes</span></div>'+progBar(st.pct)+'</div>'+
   '<div class="chips">'+per.join('')+'</div>'+
   (st.next?'<div class="row"><button class="btn primary" data-act="startW" data-id="'+esc(st.next)+'">'+ic('play','sm')+' Próximo da sequência: '+esc(wNameIn(c,st.next))+'</button></div>':'')+'</section>'+
   '<div class="stats"><div class="stat"><span class="eyebrow">Total de sessões</span><span class="v">'+st.total+'</span><span class="s">'+st.N+' treino(s) × '+c.rounds+' volta(s)</span></div>'+
   '<div class="stat"><span class="eyebrow">Dias por semana necessários</span><span class="v">'+needTxt(st)+'</span><span class="s">você informou '+st.dpw+'</span></div>'+
   '<div class="stat"><span class="eyebrow">Previsão de conclusão</span><span class="v" style="font-size:26px;line-height:1.1">'+(st.pending?fmtDate(st.forecast):'Pronto')+'</span><span class="s">no ritmo de '+st.dpw+' dia(s) por semana</span></div>'+
   '<div class="stat"><span class="eyebrow">Prazo</span><span class="v" style="font-size:26px;line-height:1.1">'+fmtDate(c.deadline)+'</span><span class="s">'+(st.daysLeft>0?'faltam '+st.daysLeft+' dia(s)':st.daysLeft===0?'termina hoje':'prazo vencido')+'</span></div></div>'+
   '<section class="card">'+warn+'<p class="muted small">Início em '+fmtDate(c.startDate)+'.'+(st.pace?' Seu ritmo até agora: '+fmt(st.pace,1)+' sessões por semana.':'')+' '+xs.length+' atividade(s) extra(s) registrada(s) no período.'+(c.autoClose===false?' A conclusão automática está desligada.':' O ciclo conclui sozinho ao atingir as sessões ou o prazo.')+'</p>'+conf+'</section>';
}
function vClosedPanel(c){
  const s=c.summary||{};
  return '<section class="confirm ok"><div class="eyebrow">Ciclo concluído</div><h2>'+esc(c.name||'Ciclo')+'</h2><p>'+esc(DONE_LABEL[c.completion]||'Concluído')+'. '+(s.sessionsDone||0)+' de '+c.totalSessions+' sessões entre '+fmtDate(c.startDate)+' e '+fmtDate(c.endDate)+'.</p>'+
   '<div class="row"><button class="btn primary" data-act="renewCycle" data-id="'+esc(c.id)+'">Renovar este treino</button><button class="btn" data-act="genNew" data-id="'+esc(c.id)+'">Gerar um novo treino</button></div>'+
   '<div class="row"><button class="btn sm" data-act="adjustWorkouts">Ajustar exercícios antes de renovar</button><button class="btn sm ghost" data-act="dismissClose" data-id="'+esc(c.id)+'">Decidir depois</button></div></section>'+
   '<p class="hint">Renovar mantém a mesma sequência e permite ajustes. Gerar um novo treino cria outra rotina pelo gerador. Os treinos e o histórico atuais nunca são apagados.</p>';
}
function cyForm(){
  const cy=S.draft.cy,sel=cy.workoutIds,err=S.ui.cyErr,title=cy.mode==='edit'?'Editar ciclo':cy.mode==='renew'?'Renovar treino':'Novo ciclo';
  return '<div class="stack"><div class="pagehead"><div class="row"><button class="btn icon" aria-label="Voltar" data-act="cancelCy">'+ic('back')+'</button><h1>'+title+'</h1></div></div>'+
   '<section class="card"><div class="field"><label for="cyName">Nome do ciclo</label><input id="cyName" class="in" data-scope="cy" data-f="name" value="'+esc(cy.name)+'"></div>'+
   '<div class="field"><span class="lab">Sequência de treinos: toque na ordem em que serão feitos</span><div class="chips">'+S.workouts.map(w=>{const i=sel.indexOf(w.id);return '<button class="chip'+(i>=0?' on':'')+'" aria-pressed="'+(i>=0)+'" data-act="cyToggleW" data-id="'+esc(w.id)+'">'+(i>=0?(i+1)+'. ':'')+esc(w.name)+'</button>'}).join('')+'</div></div>'+
   '<div class="formgrid"><div class="field"><label for="cyRounds">Voltas completas da sequência</label><input id="cyRounds" class="in" inputmode="numeric" data-scope="cy" data-f="rounds" value="'+esc(cy.rounds)+'"></div>'+
   '<div class="field"><label for="cyDpw">Dias de treino por semana</label><select id="cyDpw" class="in" data-chg="cyF" data-f="dpw">'+opts([1,2,3,4,5,6,7].map(n=>[n,n+(n===1?' dia':' dias')]),cy.dpw)+'</select></div>'+
   '<div class="field"><label for="cyStart">Início (conta sessões desde esta data)</label><input id="cyStart" type="date" class="in" data-chg="cyF" data-f="startDate" value="'+esc(cy.startDate)+'"></div>'+
   '<div class="field"><label for="cyDead">Data-limite</label><input id="cyDead" type="date" class="in" data-chg="cyF" data-f="deadline" value="'+esc(cy.deadline)+'"></div></div>'+
   '<div class="row"><button class="chip'+(cy.auto!==false?' on':'')+'" aria-pressed="'+(cy.auto!==false)+'" data-act="cyAuto">Concluir automaticamente ao atingir as sessões ou o prazo</button></div></section>'+
   '<section class="card"><h3>Cálculo do ciclo</h3><div id="cyPrev" class="stack">'+cyPreview()+'</div></section>'+
   (err?'<p class="err" role="alert">'+esc(err)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="saveCycle">'+(cy.mode==='edit'?'Salvar alterações':'Iniciar ciclo')+'</button><button class="btn" data-act="cancelCy">Cancelar</button></div></div>';
}
function cycRow(c){
  const s=c.summary||{};
  return '<button class="li" data-act="openCycle" data-id="'+esc(c.id)+'"><span class="grow"><span class="t">'+esc(c.name||'Ciclo')+'</span><span class="muted small">'+fmtDate(c.startDate)+' a '+fmtDate(c.endDate)+' · '+esc(DONE_LABEL[c.completion]||'Concluído')+'</span></span><span class="num-l">'+(s.sessionsDone||0)+'<small class="muted" style="font:600 12px var(--body)"> / '+c.totalSessions+'</small></span></button>';
}
const cycMetrics=c=>{const s=c.summary||{},w=s.weeks||1,n=s.sessionsDone||0;return {n:n,total:c.totalSessions,adh:c.totalSessions?n/c.totalSessions*100:0,perWeek:n/w,vol:s.volume||0,avgDur:n&&s.durationSec?s.durationSec/n:0,exs:(s.exercises||[]).length,xn:s.extrasCount||0,xm:s.extrasMinutes||0,weeks:w}};
function vPast(){
  const list=closedCycles();
  if(!list.length)return '<div class="empty"><div><b>Nenhum ciclo concluído ainda.</b><br>Quando você concluir um ciclo, o resumo dele fica guardado aqui para comparar com os próximos.</div></div>';
  const asc=list.slice().reverse(),items=asc.map(c=>{const m=cycMetrics(c);return {label:fmtShort(c.startDate),v:Math.round(m.perWeek*10)/10,tip:(c.name||'Ciclo')+': '+fmt(m.perWeek,1)+' sessões por semana'}});
  let cmp='';
  if(list.length>=2){
    const E=S.ui.cmpC=S.ui.cmpC||{};if(!E.a||!list.some(c=>c.id===E.a))E.a=list[1].id;if(!E.b||!list.some(c=>c.id===E.b))E.b=list[0].id;
    const A_=list.find(c=>c.id===E.a),B_=list.find(c=>c.id===E.b),ma=cycMetrics(A_),mb=cycMetrics(B_),o=list.map(c=>[c.id,(c.name||'Ciclo')+' · '+fmtShort(c.startDate)]);
    const rows=[['Sessões feitas',ma.n,mb.n,0],['Aderência (%)',ma.adh,mb.adh,0],['Sessões por semana',ma.perWeek,mb.perWeek,1],['Volume ('+unit()+')',ma.vol,mb.vol,0],['Exercícios diferentes',ma.exs,mb.exs,0],['Atividades extras',ma.xn,mb.xn,0],['Minutos de extras',ma.xm,mb.xm,0]];
    cmp='<section class="card"><h3>Comparar ciclos</h3><div class="formgrid"><div class="field"><label for="cmA">Ciclo anterior</label><select id="cmA" class="in" data-chg="cmpC" data-w="a">'+opts(o,E.a)+'</select></div><div class="field"><label for="cmB">Ciclo atual</label><select id="cmB" class="in" data-chg="cmpC" data-w="b">'+opts(o,E.b)+'</select></div></div>'+
     '<div class="scrollx"><table class="t"><thead><tr><th>Medida</th><th>Anterior</th><th>Atual</th><th>Variação</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+r[0]+'</td><td class="tn">'+fmt(r[1],r[3])+'</td><td class="tn">'+fmt(r[2],r[3])+'</td><td>'+(r[1]>0?pctTag((r[2]-r[1])/r[1]*100):'<span class="flat">–</span>')+'</td></tr>').join('')+'</tbody></table></div></section>';
  }
  return '<section class="card"><h3>Consistência por ciclo</h3><p class="muted small" style="margin-top:-6px">Sessões por semana em cada ciclo concluído</p>'+barChart(items,{label:'Sessões por semana por ciclo',half:false})+'</section>'+cmp+
   '<section class="card"><h3>Ciclos concluídos</h3><div class="list">'+list.map(cycRow).join('')+'</div></section>';
}
function vCDetail(){
  const c=S.cycles.find(x=>x.id===S.ui.cdId);
  if(!c)return '<div class="stack"><button class="btn" data-act="backCycles">Voltar</button><p class="muted">Ciclo não encontrado.</p></div>';
  const m=cycMetrics(c),s=c.summary||{},u=unit(),sess=cycleSessions(c);
  const types=Object.keys(s.extrasByType||{}).map(k=>({label:k+' ('+s.extrasByType[k].n+'x)',v:s.extrasByType[k].min}));
  return '<div class="stack"><div class="pagehead"><div class="row"><button class="btn icon" aria-label="Voltar" data-act="backCycles">'+ic('back')+'</button><div><div class="eyebrow">'+fmtDate(c.startDate)+' a '+fmtDate(c.endDate)+'</div><h1>'+esc(c.name||'Ciclo')+'</h1></div></div></div>'+
   '<div class="stats"><div class="stat"><span class="eyebrow">Sessões</span><span class="v">'+m.n+'<small>/ '+m.total+'</small></span><span class="s">'+esc(DONE_LABEL[c.completion]||'Concluído')+'</span></div>'+
   '<div class="stat"><span class="eyebrow">Aderência</span><span class="v">'+fmt(m.adh,0)+'<small>%</small></span></div>'+
   '<div class="stat"><span class="eyebrow">Por semana</span><span class="v">'+fmt(m.perWeek,1)+'</span><span class="s">em '+fmt(m.weeks,1)+' semanas</span></div>'+
   '<div class="stat"><span class="eyebrow">Volume</span><span class="v">'+fmt(m.vol,0)+'<small>'+u+'</small></span></div>'+
   '<div class="stat"><span class="eyebrow">Atividades extras</span><span class="v">'+m.xn+'</span><span class="s">'+m.xm+' min</span></div></div>'+
   (c.workouts||[]).map(w=>'<section class="card"><h3>'+esc(w.name)+'</h3><div class="list">'+(w.exercises||[]).map(e=>'<div class="li" style="padding:8px 2px"><span class="grow"><span class="t" style="font-weight:500">'+esc(e.name)+'</span></span><span class="muted small tn">'+e.sets+' × '+e.repMin+'–'+e.repMax+'</span></div>').join('')+'</div></section>').join('')+
   (types.length?'<section class="card"><h3>Atividades extras do ciclo</h3>'+hbars(types,'min')+'</section>':'')+
   '<section class="card"><h3>Sessões do ciclo</h3>'+(sess.length?'<div class="list">'+sess.map(sessRow).join('')+'</div>':'<p class="muted">As sessões individuais deste ciclo não estão mais no histórico. O resumo acima foi guardado na conclusão.</p>')+'</section>'+
   (!activeCycle()?'<div class="row"><button class="btn primary" data-act="renewCycle" data-id="'+esc(c.id)+'">Renovar este ciclo</button></div>':'')+'</div>';
}
function homeCycle(){
  if(!S.cyclesReady)return '';
  const pc=pendingClose(),c=activeCycle();
  if(c){
    const st=cycleStats(c);
    return '<section class="card"><div class="row between"><h3>'+esc(c.name||'Ciclo')+'</h3>'+(st.pending===0?'<span class="pill ok">Completo</span>':st.late?'<span class="pill bad">Atrasado</span>':'<span class="pill ok">No prazo</span>')+'</div>'+
     '<div class="row between"><span class="tn"><b>'+st.done+'</b> de '+st.total+' sessões</span><span class="muted small">até '+fmtDate(c.deadline)+'</span></div>'+progBar(st.pct)+
     '<p class="muted small">Previsão: '+(st.pending?fmtDate(st.forecast)+' com '+st.dpw+' dia(s) por semana':'sessões completas')+'. Precisa de '+needTxt(st)+' dia(s) por semana para o prazo.</p>'+
     '<div class="row">'+(st.next&&!S.session?'<button class="btn primary sm" data-act="startW" data-id="'+esc(st.next)+'">'+ic('play','sm')+' Próximo: '+esc(wNameIn(c,st.next))+'</button>':'')+'<button class="btn sm" data-act="tab" data-v="cycle">Ver ciclo</button></div></section>';
  }
  if(pc)return '<section class="card"><div class="eyebrow">Ciclo concluído</div><h3>'+esc(pc.name||'Ciclo')+'</h3><p class="muted small">Renove o treino ou gere uma nova rotina.</p><div class="row"><button class="btn primary sm" data-act="tab" data-v="cycle">Ver opções</button></div></section>';
  if(S.workouts.length)return '<section class="card"><div class="row between"><div class="grow"><h3>Prazo do treino</h3><p class="muted small">Defina uma data-limite e acompanhe quantas sessões faltam.</p></div><button class="btn primary sm" data-act="newCycle">Criar ciclo</button></div></section>';
  return '';
}

const A_CY={
  segC(d){S.seg.cycle=d.v;S.ui.confClose=false;S.ui.delX=null;render()},
  newCycle(){if(!S.workouts.length){toast('Crie ou gere um treino antes de definir um ciclo.');return}if(activeCycle()){toast('Já existe um ciclo em andamento.');return}S.draft={cy:newCycleDraft()};S.ui.cyErr='';go('cform',{tab:'cycle'})},
  editCycle(){const c=activeCycle();if(!c)return;S.draft={cy:{mode:'edit',editId:c.id,name:c.name||'',workoutIds:(c.workoutIds||[]).slice(),rounds:c.rounds,startDate:c.startDate,deadline:c.deadline,dpw:c.daysPerWeek||3,auto:c.autoClose!==false}};S.ui.cyErr='';go('cform',{tab:'cycle'})},
  cancelCy(){S.draft=null;go('cycle',{tab:'cycle'})},
  cyToggleW(d){const a=S.draft.cy.workoutIds,i=a.indexOf(d.id);if(i>=0)a.splice(i,1);else a.push(d.id);render()},
  cyAuto(){S.draft.cy.auto=S.draft.cy.auto===false;render()},
  cyUseRounds(){S.draft.cy.rounds=suggestRounds(S.draft.cy);render()},
  saveCycle(){once('cy',saveCycle)},
  askClose(){S.ui.confClose=true;render()},cancelClose(){S.ui.confClose=false;render()},
  doClose(){once('close',async()=>{const c=activeCycle();S.ui.confClose=false;if(c)await closeCycle(c,'manual');render()})},
  renewCycle(d){
    const c=S.cycles.find(x=>x.id===d.id);if(!c)return;
    if(activeCycle()){toast('Já existe um ciclo em andamento.');return}
    const ids=(c.workoutIds||[]).filter(id=>S.workouts.some(w=>w.id===id));
    if(!ids.length){toast('Os treinos deste ciclo foram removidos. Gere um novo treino.','bad');return}
    const cy=newCycleDraft(ids);cy.mode='renew';cy.renewOf=c.id;cy.dpw=c.daysPerWeek||3;cy.deadline=ymd(addDays(new Date(),Math.max(14,dd(c.deadline,c.startDate))));cy.rounds=c.rounds||suggestRounds(cy);
    S.draft={cy:cy};S.ui.cyErr='';go('cform',{tab:'cycle'});
  },
  genNew(d){S.draft={gen:genDraft({renewOf:d.id})};S.ui.genErr='';go('gform',{tab:'cycle'})},
  genOpen(){S.draft={gen:genDraft()};S.ui.genErr='';go('gform',{tab:S.tab==='workouts'?'workouts':'cycle'})},
  adjustWorkouts(){S.seg.workouts='treinos';toast('Ajuste os exercícios e volte em Ciclo para renovar.');go('workouts',{tab:'workouts'})},
  dismissClose(d){once('dismiss',async()=>{if(await safe(async()=>{await api.updateCycle(d.id,{handled:true});await reloadCycles()}))softRender()})},
  openCycle(d){S.ui.cdId=d.id;go('cdetail',{tab:'cycle'})},
  backCycles(){S.seg.cycle='anteriores';go('cycle',{tab:'cycle'})},
  genGoal(d){const g=S.draft.gen;g.goal=d.v;g.plan=null;render()},
  genMuscle(d){const g=S.draft.gen,i=g.muscles.indexOf(d.v);if(i>=0)g.muscles.splice(i,1);else g.muscles.push(d.v);g.plan=null;render()},
  genMake(){const g=S.draft.gen;g.seed=0;g.plan=genPlan(g);S.ui.genErr='';render()},
  genAgain(){const g=S.draft.gen;g.seed++;g.plan=genPlan(g);render()},
  genSwap(d){
    const w=S.draft.gen.plan[+d.w],e=w.exercises[+d.i],used=new Set(w.exercises.map(x=>x.exerciseId)),pool=allEx().filter(x=>x.group===e.group&&!used.has(x.id));
    if(!pool.length){toast('Não há outro exercício deste grupo no catálogo.');return}
    const n=pool[0];e.exerciseId=n.id;e.name=n.name;e.group=n.group;w.est=genMin(w.exercises);render();
  },
  genRm(d){const w=S.draft.gen.plan[+d.w];w.exercises.splice(+d.i,1);w.est=genMin(w.exercises);render()},
  genCycleToggle(){const g=S.draft.gen;g.createCycle=!g.createCycle;render()},
  genSave(){once('gs',genSave)},
  cancelGen(){S.draft=null;go(S.tab==='workouts'?'workouts':'cycle',{tab:S.tab==='workouts'?'workouts':'cycle'})},
  saveExtra(){once('sx',saveExtra)},
  askDelX(d){S.ui.delX=d.id;render()},
  delExtra(d){once('delx',async()=>{S.ui.delX=null;if(await safe(async()=>{await api.deleteExtra(d.id);await reloadExtras()},'Atividade excluída.'))softRender()})}
};

/* campos de texto dos formulários novos (chamado pelo app.js) */
function cyInput(sc,f,v){
  if(sc==='cy'){S.draft.cy[f]=v;const pv=$('#cyPrev');if(pv&&f==='rounds')pv.innerHTML=cyPreview()}
  else if(sc==='xf')S.ui.xf[f]=v;
}

const C_CY={
 cyF(t){S.draft.cy[t.dataset.f]=t.value;render()},
 genF(t){const g=S.draft.gen;g[t.dataset.f]=Number(t.value);g.plan=null;render()},
 xfSel(t){S.ui.xf.type=t.value;render()},
 cmpC(t){S.ui.cmpC[t.dataset.w]=t.value;render()}
};
