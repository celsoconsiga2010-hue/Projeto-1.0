'use strict';

/* ============ gráficos ============ */
function chartW(half){
  const vw=document.documentElement.clientWidth||390;
  if(vw>=900){const main=Math.min(vw-32,1160)-210-36;return Math.round(half?(main-18)/2-34:main-34)}
  return Math.max(280,vw-32-34);
}
function niceRange(min,max){
  if(min===max){min=Math.max(0,min-1);max=max+1}
  const raw=(max-min)/4,mag=Math.pow(10,Math.floor(Math.log10(raw))),n=raw/mag,step=(n<=1?1:n<=2?2:n<=5?5:10)*mag;
  return {lo:Math.floor(min/step+1e-9)*step,hi:Math.ceil(max/step-1e-9)*step,step:step};
}
function chartAxes(lo,hi,step,W,H,L,R,T,B){
  let g='';const n=Math.round((hi-lo)/step);
  for(let k=0;k<=n;k++){const v=lo+k*step,y=T+(H-T-B)*(1-(v-lo)/((hi-lo)||1));
    g+='<line class="g" x1="'+L+'" x2="'+(W-R)+'" y1="'+y.toFixed(1)+'" y2="'+y.toFixed(1)+'"/><text x="'+(L-8)+'" y="'+(y+4).toFixed(1)+'" text-anchor="end">'+fmt(v,step<1?1:0)+'</text>'}
  return g;
}
function xLabels(items,xf,H,B){
  const n=items.length,k=Math.max(1,Math.ceil(n/6));let out='',lastI=-99;
  for(let i=0;i<n;i++){if(i%k===0||(i===n-1&&i-lastI>=k/2)){lastI=i;out+='<text x="'+xf(i).toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(items[i].label)+'</text>'}}
  return out;
}
function lineChart(pts,o){
  o=o||{};if(!pts.length)return '<p class="empty">Sem registros neste período.</p>';
  const W=chartW(o.half),H=230,L=46,R=16,T=16,B=30,vals=pts.map(p=>p.v);
  let min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);if(o.zero)min=0;
  const r=niceRange(min,max),n=pts.length;
  const x=i=>n===1?L+(W-L-R)/2:L+(W-L-R)*i/(n-1),y=v=>T+(H-T-B)*(1-(v-r.lo)/((r.hi-r.lo)||1));
  const path=pts.map((p,i)=>(i?'L':'M')+x(i).toFixed(1)+' '+y(p.v).toFixed(1)).join(' ');
  const area=n>1?path+' L'+x(n-1).toFixed(1)+' '+y(r.lo).toFixed(1)+' L'+x(0).toFixed(1)+' '+y(r.lo).toFixed(1)+' Z':'';
  let dots='';
  pts.forEach((p,i)=>{const last=i===n-1;
    if(last)dots+='<circle class="halo" cx="'+x(i).toFixed(1)+'" cy="'+y(p.v).toFixed(1)+'" r="11"/>';
    dots+='<circle class="dot'+(last?' last':'')+'" cx="'+x(i).toFixed(1)+'" cy="'+y(p.v).toFixed(1)+'" r="'+(last?5.5:3.8)+'"/>'+
      '<circle class="pt" cx="'+x(i).toFixed(1)+'" cy="'+y(p.v).toFixed(1)+'" r="15" data-tip="'+esc(p.tip||'')+'"/>'});
  return '<div class="chart"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'Gráfico de linha')+'">'+
    chartAxes(r.lo,r.hi,r.step,W,H,L,R,T,B)+(area?'<path class="ar" d="'+area+'"/>':'')+(n>1?'<path class="ln" d="'+path+'"/>':'')+dots+xLabels(pts,x,H,B)+
    '</svg><div class="tip" hidden></div></div>'+(n===1?'<p class="hint">Só há um registro neste período. A linha aparece a partir do segundo.</p>':'');
}
function barChart(items,o){
  o=o||{};if(!items.length)return '<p class="empty">Sem registros neste período.</p>';
  const W=chartW(o.half),H=220,L=40,R=12,T=14,B=30,n=items.length,max=Math.max.apply(null,items.map(i=>i.v).concat([1]));
  const r=niceRange(0,max),slot=(W-L-R)/n,bw=Math.min(46,slot*0.62);
  const x=i=>L+slot*i+slot/2,y=v=>T+(H-T-B)*(1-(v-r.lo)/((r.hi-r.lo)||1));
  let bars='';items.forEach((it,i)=>{const h=Math.max(it.v>0?2:0,y(r.lo)-y(it.v));
    bars+='<rect class="bar'+(o.alt?' alt':'')+'" x="'+(x(i)-bw/2).toFixed(1)+'" y="'+(y(r.lo)-h).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+h.toFixed(1)+'" rx="3"/>'+
      '<rect class="pt" x="'+(x(i)-slot/2).toFixed(1)+'" y="'+T+'" width="'+slot.toFixed(1)+'" height="'+(H-T-B)+'" data-tip="'+esc(it.tip||it.label+': '+fmt(it.v,0))+'"/>'});
  return '<div class="chart"><svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="'+esc(o.label||'Gráfico de barras')+'">'+chartAxes(r.lo,r.hi,r.step,W,H,L,R,T,B)+bars+xLabels(items,x,H,B)+'</svg><div class="tip" hidden></div></div>';
}
function hbars(items,u){
  if(!items.length)return '<p class="empty">Sem registros neste período.</p>';
  const max=Math.max.apply(null,items.map(i=>i.v).concat([1]));
  return '<div class="stack">'+items.map(i=>'<div class="hb"><span>'+esc(i.label)+'</span><span class="bg"><span class="fg" style="width:'+Math.max(2,i.v/max*100).toFixed(1)+'%"></span></span><span class="tn muted">'+fmt(i.v,0)+(u?' '+u:'')+'</span></div>').join('')+'</div>';
}
function pctTag(p){if(p==null||!isFinite(p))return '<span class="flat">–</span>';const c=p>0.05?'up':p<-0.05?'down':'flat',a=p>0.05?'▲':p<-0.05?'▼':'●';return '<span class="'+c+' tn">'+a+' '+fmt(Math.abs(p),1)+'%</span>'}

/* ============ blocos reutilizáveis ============ */
function seg(items,cur,act){return '<div class="seg" role="tablist">'+items.map(i=>'<button role="tab" aria-selected="'+(i[0]===cur)+'" class="'+(i[0]===cur?'on':'')+'" data-act="'+act+'" data-v="'+i[0]+'">'+i[1]+'</button>').join('')+'</div>'}
function opts(list,cur,first){return (first!=null?'<option value="">'+first+'</option>':'')+list.map(o=>{const v=Array.isArray(o)?o[0]:o,l=Array.isArray(o)?o[1]:o;return '<option value="'+esc(v)+'"'+(String(v)===String(cur)?' selected':'')+'>'+esc(l)+'</option>'}).join('')}
function sessRow(s){
  const vol=sesVolume(s),n=(s.exercises||[]).reduce((a,e)=>a+setsDone(e).length,0);
  return '<button class="li" data-act="openSession" data-id="'+esc(s.id)+'"><span class="grow"><span class="t">'+esc(s.workoutName)+'</span><span class="muted small">'+fmtDate(s.date)+' · '+n+' séries'+(s.durationSec?' · '+dur(s.durationSec):'')+'</span></span><span class="num-l">'+fmt(vol,0)+'<small class="muted" style="font:600 12px var(--body)"> '+unit()+'</small></span></button>';
}
function emptyStart(){
  return '<div class="empty"><div><b>Você ainda não tem treinos.</b><br>Monte o seu do zero ou comece por três treinos de exemplo (peito e tríceps, costas e bíceps, pernas) e ajuste como quiser.</div><div class="row"><button class="btn primary" data-act="newWorkout">'+ic('plus','sm')+' Criar treino</button><button class="btn" data-act="seedExamples">Usar treinos de exemplo</button></div></div>';
}

/* ============ início ============ */
function vHome(){
  const now=new Date(),fin=finished(),wk=weekStart(now),ws=ymd(wk),week=fin.filter(s=>s.date>=ws),goal=S.profile.weekGoal||4,last=fin[0];
  const wid=(S.profile.schedule||{})['d'+now.getDay()],tw=S.workouts.find(w=>w.id===wid),did=fin.some(s=>s.date===todayStr());
  const first=(S.profile.name||'').split(' ')[0]||'atleta',hh=now.getHours(),greet=hh<12?'Bom dia':hh<18?'Boa tarde':'Boa noite';
  const dateTxt=now.toLocaleDateString('pt-BR',{weekday:'long',day:'numeric',month:'long'});
  let hero;
  if(S.session){hero='<div class="eyebrow">Em andamento</div><h2>'+esc(S.session.workoutName)+'</h2><p class="muted">Você iniciou este treino às '+new Date(S.session.startedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})+'. Seus registros estão salvos.</p><div class="row"><button class="btn primary" data-act="resume">'+ic('play','sm')+' Continuar treino</button></div>'}
  else if(tw){hero='<div class="eyebrow">Treino de hoje</div><h2>'+esc(tw.name)+'</h2><div class="chips">'+(tw.muscles||[]).map(m=>'<span class="chip">'+esc(m)+'</span>').join('')+'</div><p class="muted">'+(tw.exercises||[]).length+' exercícios'+(tw.goal?' · '+esc(tw.goal):'')+(did?' · <b class="up">você já treinou hoje</b>':'')+'</p><div class="row"><button class="btn primary" data-act="startW" data-id="'+esc(tw.id)+'">'+ic('play','sm')+' Iniciar treino</button></div>'}
  else if(S.workouts.length){hero='<div class="eyebrow">Treino de hoje</div><h2>Nada programado para hoje</h2><p class="muted">Escolha um treino para começar ou programe a semana na aba Treinos.</p><div class="row"><select id="quickW" class="in" style="max-width:260px" aria-label="Treino">'+opts(S.workouts.map(w=>[w.id,w.name]),'')+'</select><button class="btn primary" data-act="startQuick">'+ic('play','sm')+' Iniciar treino</button></div>'}
  else hero='<div class="eyebrow">Treino de hoje</div><h2>Vamos montar o primeiro treino</h2>'+emptyStart();
  const days=[0,1,2,3,4,5,6].map(i=>{const d=addDays(wk,i),has=fin.some(s=>s.date===ymd(d));return '<div class="day'+(has?' did':'')+(ymd(d)===todayStr()?' today':'')+'" title="'+d.toLocaleDateString('pt-BR')+'"><span>'+DAYS_S[(i+1)%7]+'</span><i></i></div>'}).join('');
  const vols=fin.slice(0,10).reverse().map(s=>({label:fmtShort(s.date),v:sesVolume(s),tip:fmtDate(s.date)+' · '+s.workoutName+': '+fmt(sesVolume(s),0)+' '+unit()}));
  const rank=evolutionRank().slice(0,3),prs=personalRecords().slice(0,5);
  return '<div class="stack"><div><div class="eyebrow">'+esc(dateTxt)+'</div><h1>'+greet+', '+esc(first)+'</h1></div>'+
   '<section class="hero" aria-label="Treino de hoje">'+hero+'</section>'+
   '<div class="stats"><div class="stat"><span class="eyebrow">Treinos na semana</span><span class="v">'+week.length+'<small>/ '+goal+'</small></span><span class="s">'+(week.length>=goal?'Meta da semana atingida':'Faltam '+(goal-week.length)+' para a meta')+'</span></div>'+
   '<div class="stat"><span class="eyebrow">Último treino</span><span class="v" style="font-size:26px;line-height:1.1">'+(last?esc(last.workoutName):'–')+'</span><span class="s">'+(last?fmtDate(last.date)+' · '+ago(last.date):'Nenhum treino concluído ainda')+'</span></div>'+
   '<div class="stat"><span class="eyebrow">Exercícios cadastrados</span><span class="v">'+allEx().length+'</span><span class="s">'+S.exercises.filter(e=>!e.archived).length+' criados por você</span></div></div>'+
   '<section class="card"><div class="row between"><h3>Frequência da semana</h3><span class="muted small">Seg a Dom</span></div><div class="days">'+days+'</div></section>'+
   '<div class="grid2"><section class="card"><h3>Volume por sessão</h3>'+(fin.length?'<p class="muted small" style="margin-top:-6px">Carga × repetições, últimas '+Math.min(10,fin.length)+' sessões</p>':'')+(fin.length?lineChart(vols,{label:'Volume por sessão',zero:true,half:true}):'<p class="empty">O gráfico aparece depois do primeiro treino finalizado.</p>')+'</section>'+
   '<section class="card"><h3>Evolução das cargas</h3>'+(rank.length?'<div class="list">'+rank.map(r=>'<button class="li" data-act="exEvo" data-id="'+esc(r.exId)+'"><span class="grow"><span class="t">'+esc(r.name)+'</span><span class="muted small tn">'+fmt(r.from,2)+' → '+fmt(r.to,2)+' '+unit()+'</span></span>'+pctTag(r.pct)+'</button>').join('')+'</div>':'<p class="muted">Complete duas sessões do mesmo exercício para ver a evolução da carga aqui.</p>')+
   '<hr class="sep"><h3>Recordes pessoais</h3>'+(prs.length?'<div class="list">'+prs.map(p=>'<div class="li"><span class="grow"><span class="t">'+esc(p.name)+'</span><span class="muted small">'+fmtDate(p.date)+'</span></span><span class="num-l">'+fmt(p.load,2)+' '+unit()+' × '+p.reps+'</span></div>').join('')+'</div>':'<p class="muted">Seus recordes aparecem conforme você registra séries.</p>')+'</section></div>'+
   '<section class="card"><div class="row between"><h3>Treinos recentes</h3><button class="btn sm ghost" data-act="tab" data-v="history">Ver histórico</button></div>'+(fin.length?'<div class="list">'+fin.slice(0,5).map(sessRow).join('')+'</div>':'<p class="muted">Nenhum treino concluído ainda.</p>')+'</section></div>';
}

/* ============ treinos ============ */
function vWorkouts(){
  const cur=S.seg.workouts;
  let body;
  if(cur==='exercicios')body=vCatalog();
  else if(cur==='semana')body=vWeek();
  else body=vWorkoutList();
  return '<div class="stack"><div class="pagehead"><h1>Treinos</h1>'+(cur==='treinos'?'<button class="btn primary" data-act="newWorkout">'+ic('plus','sm')+' Novo treino</button>':cur==='exercicios'?'<button class="btn primary" data-act="newExercise">'+ic('plus','sm')+' Novo exercício</button>':'')+'</div>'+
    seg([['treinos','Meus treinos'],['semana','Semana'],['exercicios','Exercícios']],cur,'segW')+body+'</div>';
}
function vWorkoutList(){
  if(!S.workouts.length)return emptyStart();
  const sc=S.profile.schedule||{};
  return S.workouts.map(w=>{
    const days=[1,2,3,4,5,6,0].filter(d=>sc['d'+d]===w.id).map(d=>DAYS[d].slice(0,3));
    const del=S.ui.delW===w.id;
    return '<article class="card"><div class="row between" style="align-items:flex-start"><div class="grow"><h3>'+esc(w.name)+'</h3><p class="muted small">'+(w.goal?esc(w.goal)+' · ':'')+(w.exercises||[]).length+' exercícios'+(days.length?' · '+days.join(', '):'')+'</p></div></div>'+
     ((w.muscles||[]).length?'<div class="chips">'+w.muscles.map(m=>'<span class="chip">'+esc(m)+'</span>').join('')+'</div>':'')+
     (w.description?'<p class="muted small">'+esc(w.description)+'</p>':'')+
     '<div class="list">'+(w.exercises||[]).map(e=>'<div class="li" style="padding:8px 2px"><span class="grow"><span class="t" style="font-weight:500">'+esc(e.name)+'</span></span><span class="muted small tn">'+e.sets+' × '+e.repMin+'–'+e.repMax+(e.load!==''&&e.load!=null?' · '+esc(e.load)+' '+unit():'')+'</span></div>').join('')+'</div>'+
     (del?'<div class="confirm"><b>Excluir "'+esc(w.name)+'"?</b><span class="small">As sessões já realizadas continuam no histórico. Só o plano do treino é removido.</span><div class="row"><button class="btn danger fill" data-act="delWorkout" data-id="'+esc(w.id)+'">Excluir treino</button><button class="btn" data-act="cancelDel">Cancelar</button></div></div>':
     '<div class="row"><button class="btn primary sm" data-act="startW" data-id="'+esc(w.id)+'">'+ic('play','sm')+' Iniciar</button><button class="btn sm" data-act="editWorkout" data-id="'+esc(w.id)+'">'+ic('edit','sm')+' Editar</button><button class="btn sm" data-act="dupWorkout" data-id="'+esc(w.id)+'">'+ic('copy','sm')+' Duplicar</button><button class="btn sm ghost danger" data-act="askDelW" data-id="'+esc(w.id)+'">'+ic('trash','sm')+' Excluir</button></div>')+
     '</article>';
  }).join('');
}
function vWeek(){
  const sc=S.profile.schedule||{};
  if(!S.workouts.length)return '<div class="empty"><div>Crie ao menos um treino para programar a semana.</div><button class="btn primary" data-act="newWorkout">Criar treino</button></div>';
  return '<section class="card"><p class="muted">Escolha qual treino cai em cada dia. Você pode mudar quando quiser, e a tela inicial mostra o treino do dia.</p>'+[1,2,3,4,5,6,0].map(d=>'<div class="sched-row"><label class="lab" for="sc'+d+'">'+DAYS[d]+'</label><select id="sc'+d+'" class="in" data-chg="sched" data-d="'+d+'">'+opts(S.workouts.map(w=>[w.id,w.name]),sc['d'+d]||'','Descanso')+'</select></div>').join('')+'</section>';
}
function catList(){
  const q=(S.ui.catQ||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(),g=S.ui.catG||'',eq=S.ui.catE||'';
  const hist=new Set(exercisesWithHistory().map(x=>x.id));
  const rows=allEx().filter(e=>(!q||e.name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(q))&&(!g||e.group===g||(e.secondary||[]).includes(g))&&(!eq||e.equip===eq)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  if(!rows.length)return '<p class="empty">Nenhum exercício encontrado. Tente outro termo ou crie um exercício seu.</p>';
  return '<div class="list">'+rows.slice(0,150).map(e=>{
    const del=S.ui.delE===e.id;
    return '<div class="li" style="align-items:flex-start;flex-wrap:wrap"><span class="grow"><span class="t">'+esc(e.name)+' <span class="tag'+(e.std?'':' mine')+'">'+(e.std?'Padrão':'Meu')+'</span></span><span class="muted small">'+esc(e.group)+(e.secondary&&e.secondary.length?' (+ '+esc(e.secondary.join(', '))+')':'')+' · '+esc(e.equip)+'</span>'+(e.desc?'<span class="muted small">'+esc(e.desc)+'</span>':'')+'</span>'+
     '<span class="row" style="flex:none">'+(hist.has(e.id)?'<button class="btn sm" data-act="exEvo" data-id="'+esc(e.id)+'">Evolução</button>':'')+(e.std?'':'<button class="btn sm icon" aria-label="Editar '+esc(e.name)+'" data-act="editExercise" data-id="'+esc(e.id)+'">'+ic('edit','sm')+'</button><button class="btn sm icon ghost danger" aria-label="Excluir '+esc(e.name)+'" data-act="askDelE" data-id="'+esc(e.id)+'">'+ic('trash','sm')+'</button>')+'</span>'+
     (del?'<div class="confirm" style="width:100%"><b>Excluir "'+esc(e.name)+'"?</b><span class="small">O histórico dele continua disponível. Treinos que usam este exercício mantêm o nome.</span><div class="row"><button class="btn danger fill sm" data-act="delExercise" data-id="'+esc(e.id)+'">Excluir</button><button class="btn sm" data-act="cancelDel">Cancelar</button></div></div>':'')+'</div>'}).join('')+(rows.length>150?'<p class="hint" style="padding-top:10px">Mostrando 150 de '+rows.length+'. Refine a busca.</p>':'')+'</div>';
}
function vCatalog(){
  return '<section class="card"><div class="field"><label for="catQ">Buscar por nome</label><input id="catQ" class="in" type="search" placeholder="Ex.: supino, agachamento" value="'+esc(S.ui.catQ||'')+'" data-scope="cat" data-f="q"></div>'+
   '<div class="formgrid"><div class="field"><label for="catG">Grupo muscular</label><select id="catG" class="in" data-chg="catFilter" data-f="catG">'+opts(GROUPS,S.ui.catG||'','Todos')+'</select></div><div class="field"><label for="catE">Equipamento</label><select id="catE" class="in" data-chg="catFilter" data-f="catE">'+opts(EQUIP,S.ui.catE||'','Todos')+'</select></div></div>'+
   '<div id="catList">'+catList()+'</div></section>';
}

/* ============ editor de treino ============ */
function wfExercise(e,i,n){
  return '<div class="exitem"><div class="row between"><div class="grow"><b>'+esc(e.name)+'</b><div class="muted small">'+esc(e.group||'')+'</div></div><div class="row" style="gap:4px"><button class="btn sm icon" aria-label="Subir" data-act="exUp" data-i="'+i+'" '+(i===0?'disabled':'')+'>'+ic('up','sm')+'</button><button class="btn sm icon" aria-label="Descer" data-act="exDown" data-i="'+i+'" '+(i===n-1?'disabled':'')+'>'+ic('down','sm')+'</button><button class="btn sm icon ghost danger" aria-label="Remover" data-act="exRemove" data-i="'+i+'">'+ic('x','sm')+'</button></div></div>'+
   '<div class="trio"><div class="field"><label for="wx'+i+'s">Séries</label><input id="wx'+i+'s" class="in num" inputmode="numeric" data-scope="wf" data-f="sets" data-i="'+i+'" value="'+esc(e.sets)+'"></div><div class="field"><label for="wx'+i+'a">Reps mín.</label><input id="wx'+i+'a" class="in num" inputmode="numeric" data-scope="wf" data-f="repMin" data-i="'+i+'" value="'+esc(e.repMin)+'"></div><div class="field"><label for="wx'+i+'b">Reps máx.</label><input id="wx'+i+'b" class="in num" inputmode="numeric" data-scope="wf" data-f="repMax" data-i="'+i+'" value="'+esc(e.repMax)+'"></div></div>'+
   '<div class="trio"><div class="field"><label for="wx'+i+'l">Carga ('+unit()+')</label><input id="wx'+i+'l" class="in num" inputmode="decimal" data-scope="wf" data-f="load" data-i="'+i+'" value="'+esc(e.load)+'" placeholder="–"></div><div class="field"><label for="wx'+i+'r">Descanso (s)</label><input id="wx'+i+'r" class="in num" inputmode="numeric" data-scope="wf" data-f="rest" data-i="'+i+'" value="'+esc(e.rest)+'"></div><div class="field"><label for="wx'+i+'i">Progressão ('+unit()+')</label><select id="wx'+i+'i" class="in" data-chg="wfInc" data-i="'+i+'">'+opts([1,1.25,2,2.5,5,10].map(v=>[v,fmt(v,2)]),e.inc==null?2.5:e.inc)+'</select></div></div>'+
   '<input class="in" placeholder="Observações do exercício (opcional)" aria-label="Observações do exercício" data-scope="wf" data-f="notes" data-i="'+i+'" value="'+esc(e.notes||'')+'"></div>';
}
function vWForm(){
  const w=S.draft.w,err=S.ui.wErr;
  return '<div class="stack"><div class="pagehead"><div class="row"><button class="btn icon" aria-label="Voltar" data-act="cancelForm">'+ic('back')+'</button><h1>'+(S.draft.isNew?'Novo treino':'Editar treino')+'</h1></div></div>'+
   '<section class="card"><div class="formgrid"><div class="field"><label for="wfName">Nome do treino</label><input id="wfName" class="in" placeholder="Ex.: A, Superior, Pernas" data-scope="wf0" data-f="name" value="'+esc(w.name)+'"></div><div class="field"><label for="wfGoal">Objetivo</label><select id="wfGoal" class="in" data-chg="wfGoal">'+opts(GOALS,w.goal||'','Selecione')+'</select></div></div>'+
   '<div class="field"><label for="wfDesc">Descrição</label><input id="wfDesc" class="in" data-scope="wf0" data-f="description" value="'+esc(w.description||'')+'"></div>'+
   '<div class="field"><span class="lab">Grupos musculares trabalhados</span><div class="chips">'+GROUPS.map(g=>'<button class="chip'+((w.muscles||[]).includes(g)?' on':'')+'" aria-pressed="'+((w.muscles||[]).includes(g))+'" data-act="toggleMuscle" data-v="'+esc(g)+'">'+esc(g)+'</button>').join('')+'</div></div>'+
   '<div class="field"><label for="wfNotes">Observações</label><textarea id="wfNotes" class="in" data-scope="wf0" data-f="notes">'+esc(w.notes||'')+'</textarea></div></section>'+
   '<section class="card"><div class="row between"><h3>Exercícios ('+w.exercises.length+')</h3><button class="btn sm" data-act="openPicker">'+ic('plus','sm')+' Adicionar</button></div>'+
   (w.exercises.length?w.exercises.map((e,i)=>wfExercise(e,i,w.exercises.length)).join(''):'<p class="empty">Nenhum exercício ainda. Toque em Adicionar para escolher no catálogo.</p>')+'</section>'+
   (err?'<p class="err" role="alert">'+esc(err)+'</p>':'')+
   '<div class="row"><button class="btn primary" data-act="saveWorkout">Salvar treino</button><button class="btn" data-act="cancelForm">Cancelar</button></div>'+
   (S.draft.isNew?'':'<p class="hint">Mudanças valem para os próximos treinos. As sessões já feitas não são alteradas.</p>')+
   (S.ui.picker?pickerSheet():'')+'</div>';
}
function pickerList(){
  const P=S.ui.picker,q=(P.q||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase(),inW=new Set(S.draft.w.exercises.map(e=>e.exerciseId));
  const rows=allEx().filter(e=>(!q||e.name.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().includes(q))&&(!P.g||e.group===P.g)).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  return rows.length?'<div class="list">'+rows.slice(0,120).map(e=>'<button class="li" data-act="pick" data-id="'+esc(e.id)+'"><span class="grow"><span class="t">'+esc(e.name)+'</span><span class="muted small">'+esc(e.group)+' · '+esc(e.equip)+'</span></span>'+(inW.has(e.id)?'<span class="tag mine">No treino</span>':ic('plus','sm'))+'</button>').join('')+'</div>':'<p class="empty">Nada encontrado. Você pode criar o exercício na aba Treinos, em Exercícios.</p>';
}
function pickerSheet(){
  const P=S.ui.picker;
  return '<div class="sheet-back" data-act="closePickerBg"><div class="sheet" role="dialog" aria-label="Escolher exercício"><div class="row between"><h3>Escolher exercício</h3><button class="btn sm" data-act="closePicker">Concluir</button></div>'+
   '<input id="pkQ" class="in" type="search" placeholder="Buscar exercício" aria-label="Buscar exercício" data-scope="pk" data-f="q" value="'+esc(P.q||'')+'"><select class="in" aria-label="Grupo muscular" data-chg="pkG">'+opts(GROUPS,P.g||'','Todos os grupos')+'</select><div class="scroll" id="pkList">'+pickerList()+'</div></div></div>';
}
function vEForm(){
  const x=S.draft.e,err=S.ui.eErr;
  return '<div class="stack"><div class="pagehead"><div class="row"><button class="btn icon" aria-label="Voltar" data-act="cancelForm">'+ic('back')+'</button><h1>'+(S.draft.isNew?'Novo exercício':'Editar exercício')+'</h1></div></div><section class="card">'+
   '<div class="field"><label for="efName">Nome</label><input id="efName" class="in" data-scope="ef" data-f="name" value="'+esc(x.name)+'"></div>'+
   '<div class="formgrid"><div class="field"><label for="efGroup">Grupo muscular principal</label><select id="efGroup" class="in" data-chg="efSel" data-f="group">'+opts(GROUPS,x.group||'','Selecione')+'</select></div><div class="field"><label for="efEquip">Equipamento</label><select id="efEquip" class="in" data-chg="efSel" data-f="equip">'+opts(EQUIP,x.equip||'','Selecione')+'</select></div></div>'+
   '<div class="field"><span class="lab">Grupos secundários</span><div class="chips">'+GROUPS.filter(g=>g!==x.group).map(g=>'<button class="chip'+((x.secondary||[]).includes(g)?' on':'')+'" aria-pressed="'+((x.secondary||[]).includes(g))+'" data-act="toggleSecondary" data-v="'+esc(g)+'">'+esc(g)+'</button>').join('')+'</div></div>'+
   '<div class="field"><label for="efDesc">Descrição da execução</label><textarea id="efDesc" class="in" data-scope="ef" data-f="desc">'+esc(x.desc||'')+'</textarea></div>'+
   '<div class="field"><label for="efNotes">Observações</label><textarea id="efNotes" class="in" data-scope="ef" data-f="notes">'+esc(x.notes||'')+'</textarea></div></section>'+
   (err?'<p class="err" role="alert">'+esc(err)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="saveExercise">Salvar exercício</button><button class="btn" data-act="cancelForm">Cancelar</button></div></div>';
}

/* ============ execução do treino ============ */
const lastEntry=id=>{const h=histFor(id);return h[h.length-1]||null};
function restBar(){
  if(!S.rest||S.rest.endsAt<=Date.now())return '';
  return '<div class="rest" id="restbar"><div><div class="eyebrow">Descanso</div><b id="resttime">'+clock((S.rest.endsAt-Date.now())/1000)+'</b></div><button class="btn sm" data-act="skipRest">Pular</button></div>';
}
function sugBox(e,i){
  const g=e.sug,u=unit(),ed=S.ui.sugEdit===i;
  return '<div class="sug '+g.type+'"><div class="eyebrow">'+(g.type==='up'?'Sugestão de progressão':'Sugestão para hoje')+'</div><div class="row between"><span>Última carga <b class="tn">'+fmt(g.current,2)+' '+u+'</b></span><span class="big">'+(g.type==='up'?'→ '+fmt(g.suggested,2)+' '+u:'manter')+'</span></div><p class="small muted">'+esc(g.reason)+' Isso é só uma sugestão. Nada muda no seu treino sem você aceitar.</p>'+
   (ed?'<div class="row"><input class="in num" style="max-width:120px" inputmode="decimal" aria-label="Carga sugerida" data-scope="sugv" data-ex="'+i+'" value="'+esc(g.suggested)+'"><button class="btn primary sm" data-act="sugApplyEdit" data-ex="'+i+'">Aplicar</button><button class="btn sm" data-act="sugCancelEdit">Cancelar</button></div>':
   '<div class="row"><button class="btn primary sm" data-act="sugAccept" data-ex="'+i+'">Aceitar</button><button class="btn sm" data-act="sugEdit" data-ex="'+i+'">Editar</button><button class="btn sm ghost" data-act="sugIgnore" data-ex="'+i+'">Ignorar</button></div>')+'</div>';
}
function setRow(e,i,s,j,last){
  const pv=last&&last.sets[j]?fmt(num(last.sets[j].load),2)+'×'+last.sets[j].reps:'–';
  return '<div class="setrow'+(s.done?' done':'')+'"><span class="n">'+(j+1)+'</span><span class="prev">'+pv+'</span>'+
   '<input class="in num" inputmode="decimal" aria-label="Carga da série '+(j+1)+'" placeholder="'+unit()+'" data-scope="ses" data-f="load" data-ex="'+i+'" data-set="'+j+'" value="'+esc(s.load)+'">'+
   '<input class="in num" inputmode="numeric" aria-label="Repetições da série '+(j+1)+'" placeholder="reps" data-scope="ses" data-f="reps" data-ex="'+i+'" data-set="'+j+'" value="'+esc(s.reps)+'">'+
   '<button class="chk'+(s.done?' on':'')+'" aria-pressed="'+(!!s.done)+'" aria-label="'+(s.done?'Desmarcar':'Concluir')+' série '+(j+1)+'" data-act="toggleSet" data-ex="'+i+'" data-set="'+j+'">'+ic('check')+'</button></div>';
}
function exCard(e,i){
  const p=e.planned,last=lastEntry(e.exerciseId),u=unit();
  const lastTxt=last?'Última vez ('+fmtShort(last.date)+'): '+last.sets.map(s=>fmt(num(s.load),2)+'×'+s.reps).join(' · '):'Primeira vez neste exercício.';
  return '<section class="card" aria-label="'+esc(e.name)+'"><div><h3>'+esc(e.name)+'</h3><p class="muted small">'+p.sets+' séries · '+p.repMin+'–'+p.repMax+' reps · descanso '+p.rest+' s'+(e.sug&&e.sug.status==='accepted'?' · <span class="up">sugestão aceita</span>':'')+'</p></div><p class="small muted">'+esc(lastTxt)+'</p>'+
   (e.sug&&e.sug.status==='pending'?sugBox(e,i):'')+
   '<div class="sethead"><span>#</span><span>Anterior</span><span>'+u+'</span><span>Reps</span><span></span></div>'+e.sets.map((s,j)=>setRow(e,i,s,j,last)).join('')+
   '<div class="row"><button class="btn sm" data-act="addSet" data-ex="'+i+'">'+ic('plus','sm')+' Série</button><button class="btn sm ghost" data-act="rmSet" data-ex="'+i+'" '+(e.sets.length<=1?'disabled':'')+'>'+ic('minus','sm')+' Remover série</button></div>'+
   '<textarea class="in" style="min-height:60px" placeholder="Observações deste exercício" aria-label="Observações de '+esc(e.name)+'" data-scope="ses" data-f="exnotes" data-ex="'+i+'">'+esc(e.notes||'')+'</textarea></section>';
}
function vSession(){
  const ses=S.session,total=ses.exercises.reduce((a,e)=>a+e.sets.length,0),dn=ses.exercises.reduce((a,e)=>a+e.sets.filter(s=>s.done).length,0),vol=ses.exercises.reduce((a,e)=>a+exVolume(e),0);
  const fin=S.ui.confirmFinish?'<div class="confirm ok"><b>Finalizar este treino?</b><span class="small">'+dn+' de '+total+' séries concluídas · volume '+fmt(vol,0)+' '+unit()+'. Séries sem o check não entram no histórico.</span>'+(S.ui.finErr?'<span class="err" role="alert">'+esc(S.ui.finErr)+'</span>':'')+'<div class="row"><button class="btn primary" data-act="finish">Confirmar e finalizar</button><button class="btn" data-act="cancelFinish">Voltar ao treino</button></div></div>':'<button class="btn primary lg" data-act="askFinish">Finalizar treino</button>';
  const dis=S.ui.confirmDiscard?'<div class="confirm"><b>Descartar este treino?</b><span class="small">Nada será salvo no histórico.</span><div class="row"><button class="btn danger fill" data-act="discard">Descartar</button><button class="btn" data-act="cancelDiscard">Voltar</button></div></div>':'<button class="btn danger ghost" data-act="askDiscard">Descartar treino</button>';
  return '<div class="stack"><div class="sticky"><div class="row between"><button class="btn sm ghost" data-act="leaveSession">'+ic('back','sm')+' Sair da tela</button><span id="sync" class="sync '+S.sync+'">'+SYNC_TXT[S.sync]+'</span></div>'+
   '<div class="row between" style="margin-top:8px"><div><div class="eyebrow">Treino em andamento</div><h2>'+esc(ses.workoutName)+'</h2></div><div class="timer" id="elapsed" aria-label="Tempo de treino">'+clock((Date.now()-new Date(ses.startedAt))/1000)+'</div></div>'+restBar()+'</div>'+
   ses.exercises.map(exCard).join('')+
   '<section class="card"><label class="lab" for="sesNotes">Observações gerais do treino</label><textarea id="sesNotes" class="in" data-scope="ses" data-f="notes">'+esc(ses.notes||'')+'</textarea></section>'+fin+dis+'</div>';
}

/* ============ histórico ============ */
function vHistory(){
  const cur=S.seg.history;
  return '<div class="stack"><div class="pagehead"><h1>Histórico</h1></div>'+seg([['sessoes','Sessões'],['evolucao','Evolução'],['relatorios','Relatórios']],cur,'segH')+(cur==='evolucao'?vEvolution():cur==='relatorios'?vReports():vSessions())+'</div>';
}
function vSessions(){
  const H=S.ui.hist=S.ui.hist||{period:'all',workoutId:''};
  const rows=finished().filter(s=>inPeriod(s.date,H)&&(!H.workoutId||s.workoutId===H.workoutId));
  return '<section class="card"><div class="formgrid"><div class="field"><label for="hP">Período</label><select id="hP" class="in" data-chg="histF" data-f="period">'+opts([['7','7 dias'],['30','30 dias'],['90','90 dias'],['all','Tudo']],H.period)+'</select></div><div class="field"><label for="hW">Treino</label><select id="hW" class="in" data-chg="histF" data-f="workoutId">'+opts(S.workouts.map(w=>[w.id,w.name]),H.workoutId,'Todos')+'</select></div></div>'+
   (rows.length?'<div class="list">'+rows.map(sessRow).join('')+'</div>':'<p class="empty">Nenhum treino concluído neste filtro.</p>')+'</section>';
}
function vSessionDetail(){
  const s=S.sessions.find(x=>x.id===S.sel);
  if(!s)return '<div class="stack"><button class="btn" data-act="tab" data-v="history">Voltar ao histórico</button><p class="muted">Sessão não encontrada.</p></div>';
  const del=S.ui.delS===s.id,u=unit();
  return '<div class="stack"><div class="pagehead"><div class="row"><button class="btn icon" aria-label="Voltar" data-act="backHist">'+ic('back')+'</button><div><div class="eyebrow">'+fmtDate(s.date)+'</div><h1>'+esc(s.workoutName)+'</h1></div></div></div>'+
   '<div class="stats"><div class="stat"><span class="eyebrow">Volume</span><span class="v">'+fmt(sesVolume(s),0)+'<small>'+u+'</small></span></div><div class="stat"><span class="eyebrow">Duração</span><span class="v">'+(s.durationSec?dur(s.durationSec):'–')+'</span></div><div class="stat"><span class="eyebrow">Séries</span><span class="v">'+(s.exercises||[]).reduce((a,e)=>a+setsDone(e).length,0)+'</span></div></div>'+
   (s.exercises||[]).map(e=>'<section class="card"><div class="row between"><h3>'+esc(e.name)+'</h3><button class="btn sm ghost" data-act="exEvo" data-id="'+esc(e.exerciseId)+'">Ver evolução</button></div><div class="scrollx"><table class="t"><thead><tr><th>Série</th><th>Carga</th><th>Reps</th><th>Volume</th></tr></thead><tbody>'+setsDone(e).map((x,j)=>'<tr><td>'+(j+1)+'</td><td class="tn">'+fmt(num(x.load),2)+' '+u+'</td><td class="tn">'+x.reps+'</td><td class="tn">'+fmt(num(x.load)*num(x.reps),0)+'</td></tr>').join('')+'</tbody></table></div>'+(e.notes?'<p class="small muted">Obs.: '+esc(e.notes)+'</p>':'')+'</section>').join('')+
   (s.notes?'<section class="card"><h3>Observações</h3><p>'+esc(s.notes)+'</p></section>':'')+
   (del?'<div class="confirm"><b>Excluir esta sessão?</b><span class="small">Os registros dela saem do histórico e dos gráficos. Não dá para desfazer.</span><div class="row"><button class="btn danger fill" data-act="delSession" data-id="'+esc(s.id)+'">Excluir sessão</button><button class="btn" data-act="cancelDel">Cancelar</button></div></div>':'<div class="row"><button class="btn danger ghost" data-act="askDelS" data-id="'+esc(s.id)+'">'+ic('trash','sm')+' Excluir sessão</button></div>')+'</div>';
}
const METRICS={load:{key:'maxLoad',label:'Carga máxima',u:()=>unit(),d:2},reps:{key:'bestReps',label:'Melhor série (repetições)',u:()=>'reps',d:0},vol:{key:'volume',label:'Volume total',u:()=>unit(),d:0}};
function vEvolution(){
  const list=exercisesWithHistory();
  if(!list.length)return '<div class="empty"><div><b>Ainda não há histórico para mostrar.</b><br>Finalize um treino e a evolução de cada exercício aparece aqui.</div></div>';
  const E=S.ui.evo=S.ui.evo||{exId:'',period:'90',from:'',to:'',metric:'load',gran:'sessao',a:'',b:''};
  if(!E.exId||!list.some(x=>x.id===E.exId))E.exId=list[0].id;
  const all=histFor(E.exId),ent=all.filter(e=>inPeriod(e.date,E)),M=METRICS[E.metric],bk=bucket(ent,E.gran),u=M.u();
  const pts=bk.map(b=>({label:b.label,v:b[M.key],tip:b.label+' · '+fmt(b[M.key],M.d)+' '+u}));
  const maxL=ent.length?Math.max.apply(null,ent.map(e=>e.maxLoad)):0,bestR=ent.length?Math.max.apply(null,ent.map(e=>e.bestReps)):0;
  const pct=ent.length>1&&ent[0].maxLoad>0?(ent[ent.length-1].maxLoad-ent[0].maxLoad)/ent[0].maxLoad*100:null;
  const ex=exById(E.exId);
  let cmp='';
  if(all.length<2)cmp='<p class="muted">Ainda não existe histórico suficiente para comparar. Faça este exercício em mais uma sessão.</p>';
  else{
    if(!E.a||!all.some(x=>x.sid===E.a))E.a=all[all.length-2].sid;
    if(!E.b||!all.some(x=>x.sid===E.b))E.b=all[all.length-1].sid;
    const A=all.find(x=>x.sid===E.a),B=all.find(x=>x.sid===E.b),o=all.map(x=>[x.sid,fmtDate(x.date)+' · '+x.workout]);
    const rows=[['Carga máxima ('+unit()+')',A.maxLoad,B.maxLoad,2],['Repetições totais',A.totalReps,B.totalReps,0],['Melhor série (reps)',A.bestReps,B.bestReps,0],['Volume ('+unit()+')',A.volume,B.volume,0]];
    cmp='<div class="formgrid"><div class="field"><label for="cA">Sessão anterior</label><select id="cA" class="in" data-chg="evoCmp" data-w="a">'+opts(o,E.a)+'</select></div><div class="field"><label for="cB">Sessão atual</label><select id="cB" class="in" data-chg="evoCmp" data-w="b">'+opts(o,E.b)+'</select></div></div><div class="scrollx"><table class="t"><thead><tr><th>Medida</th><th>Anterior</th><th>Atual</th><th>Diferença</th><th>Variação</th></tr></thead><tbody>'+
     rows.map(r=>'<tr><td>'+r[0]+'</td><td class="tn">'+fmt(r[1],r[3])+'</td><td class="tn">'+fmt(r[2],r[3])+'</td><td class="tn">'+(r[2]-r[1]>0?'+':'')+fmt(r[2]-r[1],r[3])+'</td><td>'+(r[1]>0?pctTag((r[2]-r[1])/r[1]*100):'<span class="flat">–</span>')+'</td></tr>').join('')+'</tbody></table></div>';
  }
  return '<section class="card"><div class="field"><label for="eEx">Exercício</label><select id="eEx" class="in" data-chg="evoF" data-f="exId">'+opts(list.map(x=>[x.id,x.name]),E.exId)+'</select></div>'+
   '<div class="formgrid"><div class="field"><label for="eP">Período</label><select id="eP" class="in" data-chg="evoF" data-f="period">'+opts([['30','30 dias'],['90','90 dias'],['180','6 meses'],['365','1 ano'],['all','Tudo'],['custom','Personalizado']],E.period)+'</select></div><div class="field"><label for="eG">Agrupar por</label><select id="eG" class="in" data-chg="evoF" data-f="gran">'+opts([['sessao','Sessão (dia)'],['semana','Semana'],['mes','Mês']],E.gran)+'</select></div></div>'+
   (E.period==='custom'?'<div class="formgrid"><div class="field"><label for="eF">De</label><input id="eF" type="date" class="in" data-chg="evoF" data-f="from" value="'+esc(E.from)+'"></div><div class="field"><label for="eT">Até</label><input id="eT" type="date" class="in" data-chg="evoF" data-f="to" value="'+esc(E.to)+'"></div></div>':'')+
   seg([['load','Carga'],['reps','Repetições'],['vol','Volume']],E.metric,'segM')+
   '<h3>'+esc(ex?ex.name:'')+' · '+M.label+'</h3>'+lineChart(pts,{label:M.label+' de '+(ex?ex.name:''),zero:E.metric==='vol'})+
   '<p class="hint">Carga e repetições andam juntas. Mais peso com menos repetições, ou o contrário, nem sempre é evolução. Olhe também o volume e as condições da execução.</p></section>'+
   '<div class="stats"><div class="stat"><span class="eyebrow">Maior carga</span><span class="v">'+fmt(maxL,2)+'<small>'+unit()+'</small></span></div><div class="stat"><span class="eyebrow">Melhor série</span><span class="v">'+bestR+'<small>reps</small></span></div><div class="stat"><span class="eyebrow">Evolução da carga</span><span class="v" style="font-size:30px">'+pctTag(pct)+'</span><span class="s">primeira à última sessão do período</span></div><div class="stat"><span class="eyebrow">Sessões</span><span class="v">'+ent.length+'</span></div></div>'+
   '<section class="card"><h3>Registros do período</h3>'+(ent.length?'<div class="scrollx"><table class="t"><thead><tr><th>Data</th><th>Treino</th><th>Séries (carga×reps)</th><th>Volume</th></tr></thead><tbody>'+ent.slice().reverse().map(e=>'<tr><td>'+fmtDate(e.date)+'</td><td>'+esc(e.workout)+'</td><td class="tn">'+e.sets.map(s=>fmt(num(s.load),2)+'×'+s.reps).join(' · ')+'</td><td class="tn">'+fmt(e.volume,0)+'</td></tr>').join('')+'</tbody></table></div>':'<p class="muted">Sem registros neste período.</p>')+'</section>'+
   '<section class="card"><h3>Comparar duas sessões</h3>'+cmp+'</section>';
}

/* ============ relatórios ============ */
function repData(R){
  const out=[];
  finished().forEach(s=>{
    if(!inPeriod(s.date,R)||(R.workoutId&&s.workoutId!==R.workoutId))return;
    const exs=(s.exercises||[]).filter(e=>setsDone(e).length&&(!R.group||e.group===R.group));
    if(!exs.length)return;
    out.push({s:s,exs:exs,vol:exs.reduce((a,e)=>a+exVolume(e),0),sets:exs.reduce((a,e)=>a+setsDone(e).length,0)});
  });
  return out;
}
function vReports(){
  const R=S.ui.rep=S.ui.rep||{period:'90',from:'',to:'',workoutId:'',group:''};
  const D=repData(R),asc=D.slice().reverse(),vol=D.reduce((a,x)=>a+x.vol,0),sets=D.reduce((a,x)=>a+x.sets,0);
  const withDur=D.filter(x=>x.s.durationSec),avgDur=withDur.length?withDur.reduce((a,x)=>a+x.s.durationSec,0)/withDur.length:0;
  let prev=null,days=0;
  if(R.period!=='all'){
    if(R.period==='custom'&&R.from&&R.to)days=Math.round((parseYmd(R.to)-parseYmd(R.from))/864e5)+1;
    else if(R.period!=='custom')days=Number(R.period);
    if(days>0){const end=R.period==='custom'?parseYmd(R.from):addDays(new Date(),-days+1),start=addDays(end,-days);
      const P={period:'custom',from:ymd(start),to:ymd(addDays(end,-1)),workoutId:R.workoutId,group:R.group},pd=repData(P);prev={n:pd.length,vol:pd.reduce((a,x)=>a+x.vol,0)}}
  }
  const weeks=new Map();D.forEach(x=>{const k=ymd(weekStart(parseYmd(x.s.date)));weeks.set(k,(weeks.get(k)||0)+1)});
  let wItems=[];if(weeks.size){const ks=Array.from(weeks.keys()).sort();let d=parseYmd(ks[0]);const end=parseYmd(ks[ks.length-1]);while(d<=end){const k=ymd(d);wItems.push({label:fmtShort(k),v:weeks.get(k)||0,tip:'Semana de '+fmtShort(k)+': '+(weeks.get(k)||0)+' treinos'});d=addDays(d,7)}wItems=wItems.slice(-12)}
  const gm=new Map();D.forEach(x=>x.exs.forEach(e=>gm.set(e.group||'Outros',(gm.get(e.group||'Outros')||0)+exVolume(e))));
  const gItems=Array.from(gm.entries()).map(a=>({label:a[0],v:a[1]})).sort((a,b)=>b.v-a.v);
  const rank=evolutionRank(id=>histFor(id).filter(e=>inPeriod(e.date,R)&&(!R.workoutId||(S.sessions.find(s=>s.id===e.sid)||{}).workoutId===R.workoutId))).slice(0,5);
  const prs=personalRecords().filter(p=>!R.group||((exById(p.exId)||{}).group===R.group)).slice(0,5);
  const vpts=asc.map(x=>({label:fmtShort(x.s.date),v:x.vol,tip:fmtDate(x.s.date)+' · '+x.s.workoutName+': '+fmt(x.vol,0)+' '+unit()}));
  return '<section class="card"><div class="formgrid"><div class="field"><label for="rP">Período</label><select id="rP" class="in" data-chg="repF" data-f="period">'+opts([['30','30 dias'],['90','90 dias'],['180','6 meses'],['365','1 ano'],['all','Tudo'],['custom','Personalizado']],R.period)+'</select></div><div class="field"><label for="rW">Treino</label><select id="rW" class="in" data-chg="repF" data-f="workoutId">'+opts(S.workouts.map(w=>[w.id,w.name]),R.workoutId,'Todos')+'</select></div><div class="field"><label for="rG">Grupo muscular</label><select id="rG" class="in" data-chg="repF" data-f="group">'+opts(GROUPS,R.group,'Todos')+'</select></div></div>'+
   (R.period==='custom'?'<div class="formgrid"><div class="field"><label for="rF">De</label><input id="rF" type="date" class="in" data-chg="repF" data-f="from" value="'+esc(R.from)+'"></div><div class="field"><label for="rT">Até</label><input id="rT" type="date" class="in" data-chg="repF" data-f="to" value="'+esc(R.to)+'"></div></div>':'')+
   '<div class="row"><button class="btn sm" data-act="exportCsv">'+ic('dl','sm')+' Exportar CSV</button><button class="btn sm" data-act="printReport">'+ic('dl','sm')+' Salvar em PDF</button></div><p class="hint">O CSV leva as séries do filtro atual. Para o PDF, escolha "Salvar como PDF" na janela de impressão.</p></section>'+
   (D.length?'':'<p class="empty">Nenhum treino concluído neste filtro.</p>')+
   '<div class="stats"><div class="stat"><span class="eyebrow">Treinos concluídos</span><span class="v">'+D.length+'</span>'+(prev?'<span class="s">'+pctTagText(D.length,prev.n)+' vs. período anterior ('+prev.n+')</span>':'')+'</div><div class="stat"><span class="eyebrow">Volume total</span><span class="v">'+fmt(vol,0)+'<small>'+unit()+'</small></span>'+(prev?'<span class="s">'+pctTagText(vol,prev.vol)+' vs. período anterior</span>':'')+'</div><div class="stat"><span class="eyebrow">Séries</span><span class="v">'+sets+'</span></div><div class="stat"><span class="eyebrow">Duração média</span><span class="v" style="font-size:28px">'+(avgDur?dur(avgDur):'–')+'</span></div></div>'+
   '<div class="grid2"><section class="card"><h3>Volume por sessão</h3>'+lineChart(vpts,{label:'Volume por sessão',zero:true,half:true})+'</section><section class="card"><h3>Frequência semanal</h3>'+barChart(wItems,{label:'Treinos por semana',alt:true,half:true})+'</section></div>'+
   '<div class="grid2"><section class="card"><h3>Volume por grupo muscular</h3>'+hbars(gItems,unit())+'</section><section class="card"><h3>Maior evolução de carga</h3>'+(rank.length?'<div class="list">'+rank.map(r=>'<button class="li" data-act="exEvo" data-id="'+esc(r.exId)+'"><span class="grow"><span class="t">'+esc(r.name)+'</span><span class="muted small tn">'+fmt(r.from,2)+' → '+fmt(r.to,2)+' '+unit()+'</span></span>'+pctTag(r.pct)+'</button>').join('')+'</div>':'<p class="muted">Precisa de ao menos duas sessões do mesmo exercício no período.</p>')+'<hr class="sep"><h3>Recordes pessoais</h3>'+(prs.length?'<div class="list">'+prs.map(p=>'<div class="li"><span class="grow"><span class="t">'+esc(p.name)+'</span><span class="muted small">'+fmtDate(p.date)+'</span></span><span class="num-l">'+fmt(p.load,2)+' '+unit()+' × '+p.reps+'</span></div>').join('')+'</div>':'<p class="muted">Sem recordes ainda.</p>')+'</section></div>'+
   '<section class="card"><h3>Histórico completo do filtro</h3>'+(D.length?'<div class="list">'+D.map(x=>sessRow(x.s)).join('')+'</div>':'<p class="muted">Nada para listar.</p>')+'</section>';
}
function pctTagText(cur,prev){if(!prev)return cur>0?'<span class="up">novo</span>':'<span class="flat">–</span>';return pctTag((cur-prev)/prev*100)}
