'use strict';
/* ============ compartilhamento de treinos entre usuários ============
   Fluxo: A escolhe um treino > busca B (usuário, e-mail ou ID) > convite "pendente"
   > B aceita (ganha uma CÓPIA independente) ou recusa. Toda a regra (permissões, cópia,
   duplicidade, status) fica no banco, nas funções share_workout / respond_share /
   cancel_share (veja supabase/schema.sql, seção 5d). Aqui ficam só as telas e os avisos. */
const SH_LABEL={pendente:'Pendente',aceito:'Aceito',recusado:'Recusado',cancelado:'Cancelado'};
const fmtDT=iso=>{if(!iso)return '';const d=new Date(iso);return isNaN(d)?'':d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'})+' às '+d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})};

function setShares(list){
  list=list||[];
  S.shares={rec:list.filter(s=>s.to===S.uid),sent:list.filter(s=>s.from===S.uid)};
}
const pendingRec=()=>S.shares.rec.filter(s=>s.status==='pendente');
const pendingCount=()=>S.sharesReady?pendingRec().length:0;
const shBadge=n=>n?'<i class="bdg" aria-label="'+n+' convite'+(n>1?'s':'')+' de treino">'+n+'</i>':'';

/* recarrega os convites; devolve os convites pendentes que ainda não existiam */
async function reloadShares(){
  const before=new Set(S.shares.rec.map(s=>s.id)),list=await api.loadShares();
  setShares(list);
  return pendingRec().filter(s=>!before.has(s.id));
}
function sharesNotify(fresh){
  if(!fresh.length)return;
  const s=fresh[0],txt=fresh.length>1?fresh.length+' treinos novos foram compartilhados com você.':(s.fromName||'Alguém')+' compartilhou um treino com você.';
  if(document.hidden&&S.profile&&S.profile.notifications&&('Notification' in window)&&Notification.permission==='granted'){
    try{navigator.serviceWorker.ready.then(r=>r.showNotification('Treino recebido',{body:txt,icon:'icons/icon-192.png',tag:'share'})).catch(()=>{})}catch(e){}
  }else toast(txt);
}
/* ao abrir o app: avisa uma vez dos convites que ainda não foram vistos */
function sharesBoot(){
  if(!S.sharesReady)return;
  const unseen=pendingRec().filter(s=>!s.seen);
  if(unseen.length)sharesNotify(unseen);
}
let shPollAt=0;
async function sharesPoll(){
  if(S.boot!=='ready'||S.offlineData||!navigator.onLine||!S.sharesReady||S.refreshing||Date.now()-shPollAt<20000)return;
  shPollAt=Date.now();
  try{const fresh=await reloadShares();if(fresh.length){sharesNotify(fresh);softRender()}}catch(e){}
}
setInterval(()=>{if(!document.hidden)sharesPoll()},60000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)sharesPoll()});

/* ---------- telas ---------- */
function shExRows(list){
  return '<div class="list">'+(list||[]).map(e=>'<div class="li" style="padding:8px 2px"><span class="grow"><span class="t" style="font-weight:500">'+esc(e.name)+'</span></span><span class="muted small tn">'+e.sets+' × '+e.rep_min+'–'+e.rep_max+'</span></div>').join('')+'</div>';
}
function shPill(st){return '<span class="pill'+(st==='aceito'?' ok':st==='recusado'||st==='cancelado'?' bad':'')+'">'+SH_LABEL[st]+'</span>'}
function shInviteCard(s){
  const sm=s.summary||{};
  return '<article class="card" aria-label="Convite de treino: '+esc(s.name)+'"><div class="row between" style="align-items:flex-start"><div class="grow"><div class="eyebrow">Convite de treino'+(s.seen?'':' · <span class="up">novo</span>')+'</div><h3>'+esc(s.name)+'</h3>'+
   '<p class="muted small">De <b>'+esc(s.fromName)+'</b> · '+fmtDT(s.at)+'</p><p class="muted small">'+s.count+' exercício'+(s.count===1?'':'s')+(sm.goal?' · '+esc(sm.goal):'')+'</p></div></div>'+
   ((sm.muscles||[]).length?'<div class="chips">'+sm.muscles.map(m=>'<span class="chip">'+esc(m)+'</span>').join('')+'</div>':'')+
   (sm.description?'<p class="muted small">'+esc(sm.description)+'</p>':'')+shExRows(sm.exercises)+
   '<p class="hint">Ao aceitar, você ganha uma cópia só sua em Meus treinos, que pode editar à vontade. Mudanças feitas por '+esc(s.fromName)+' depois disso não alteram a sua cópia.</p>'+
   '<div class="row"><button class="btn primary" data-act="shAccept" data-id="'+esc(s.id)+'"'+(S.ui.shBusy?' disabled':'')+'>Aceitar</button><button class="btn" data-act="shDecline" data-id="'+esc(s.id)+'"'+(S.ui.shBusy?' disabled':'')+'>Recusar</button></div></article>';
}
function shHistRow(s,mine){
  const who=mine?'Para <b>'+esc(s.toName)+'</b>':'De <b>'+esc(s.fromName)+'</b>';
  return '<div class="li"><span class="grow"><span class="t">'+esc(s.name)+'</span><span class="muted small">'+who+' · enviado em '+fmtDT(s.at)+(s.respondedAt?' · '+(s.status==='cancelado'?'cancelado':'respondido')+' em '+fmtDT(s.respondedAt):'')+'</span></span>'+shPill(s.status)+
   (mine&&s.status==='pendente'?'<button class="btn sm ghost danger" data-act="shCancel" data-id="'+esc(s.id)+'">Cancelar</button>':'')+'</div>';
}
function vShares(){
  if(!S.sharesReady)return '<section class="card"><h3>Falta atualizar o banco de dados</h3><p class="muted">Para receber e enviar treinos, rode de novo o arquivo <code>supabase/schema.sql</code> no SQL Editor do Supabase. O resto do app continua funcionando.</p></section>';
  const pend=pendingRec(),done=S.shares.rec.filter(s=>s.status!=='pendente'),sent=S.shares.sent;
  if(pend.some(s=>!s.seen)&&!S.ui.shMarking){S.ui.shMarking=true;api.markSharesSeen().then(()=>{S.shares.rec.forEach(s=>{s.seen=true});S.ui.shMarking=false})}
  return '<div class="stack"><div><h3 style="margin-bottom:8px">Convites pendentes</h3>'+
    (pend.length?'<div class="stack">'+pend.map(shInviteCard).join('')+'</div>':'<section class="card"><p class="muted">Nenhum convite de treino por aqui. Quando alguém compartilhar um treino com você, ele aparece neste lugar.</p></section>')+'</div>'+
    (done.length?'<section class="card"><h3>Recebidos anteriormente</h3><div class="list">'+done.map(s=>shHistRow(s,false)).join('')+'</div></section>':'')+
    (sent.length?'<section class="card"><h3>Treinos que você enviou</h3><div class="list">'+sent.map(s=>shHistRow(s,true)).join('')+'</div></section>':'<section class="card"><h3>Treinos que você enviou</h3><p class="muted">Para enviar, abra <b>Meus treinos</b> e toque em <b>Compartilhar</b> no treino escolhido.</p></section>')+'</div>';
}
function homeShares(){
  const n=pendingCount();if(!n)return '';
  const first=pendingRec()[0];
  return '<section class="card" aria-label="Treinos recebidos"><div class="row between"><div class="grow"><div class="eyebrow">Treino recebido</div><h3>'+(n===1?esc(first.fromName)+' compartilhou um treino com você':n+' treinos compartilhados com você')+'</h3><p class="muted small">'+(n===1?esc(first.name)+' · ':'')+'Veja os detalhes e escolha aceitar ou recusar.</p></div></div><div class="row"><button class="btn primary" data-act="shGoReceived">Ver convites</button></div></section>';
}

/* ---------- janela de compartilhar ---------- */
function shareSheet(){
  const sh=S.ui.shSheet;if(!sh)return '';
  const f=sh.found,nm=esc(sh.name);
  return '<div class="sheet-back" data-act="shSheetBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Compartilhar treino"><div class="row between"><h3>Compartilhar treino</h3><button class="btn sm" data-act="shSheetClose">Fechar</button></div>'+
   '<div class="scroll vsheet"><p class="muted small">Treino: <b>'+nm+'</b> ('+sh.count+' exercício'+(sh.count===1?'':'s')+'). A pessoa recebe um convite e, se aceitar, fica com uma cópia só dela. Depois disso os dois treinos são independentes.</p>'+
   '<div class="field"><label for="shQ">Nome de usuário, e-mail ou ID</label><div class="row"><input id="shQ" class="in grow" type="text" autocomplete="off" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="ex.: maria.silva" data-scope="sh" data-f="q" value="'+esc(sh.q)+'"><button class="btn" data-act="shSearch"'+(sh.busy?' disabled':'')+'>Buscar</button></div><p class="hint">Só aparecem contas cadastradas, pelo nome de usuário, e-mail ou ID exatos.</p></div>'+
   (sh.err?'<p class="err" role="alert">'+esc(sh.err)+'</p>':'')+
   (f?'<div class="card" style="background:var(--surface-2)"><div class="row between"><div class="grow"><b>'+esc(f.full_name)+'</b><div class="muted small">@'+esc(f.username)+'</div></div></div><div class="row"><button class="btn primary" data-act="shSend"'+(sh.busy?' disabled':'')+'>'+(sh.busy?'Enviando…':'Enviar convite para '+esc(f.full_name.split(' ')[0]))+'</button></div></div>':'')+
   '</div></div></div>';
}
function shCloseSheet(){if(S.ui.shSheet&&S.ui.shSheet.busy)return;S.ui.shSheet=null;render()}
function shIsMe(q){
  q=q.trim().toLowerCase().replace(/^@/,'');
  return q===(S.profile.username||'').toLowerCase()||q===(S.email||'').toLowerCase()||q===String(S.uid||'').toLowerCase();
}
async function shSearch(){
  const sh=S.ui.shSheet;if(!sh||sh.busy)return;
  const q=(sh.q||'').trim();
  sh.found=null;sh.err='';
  if(q.replace(/^@/,'').length<3){sh.err='Digite pelo menos 3 caracteres: nome de usuário, e-mail ou ID.';render();return}
  if(shIsMe(q)){sh.err='Você não pode compartilhar um treino com você mesmo.';render();return}
  sh.busy=true;render();
  try{
    const r=await api.findShareTarget(q);
    sh.busy=false;
    if(!r.length)sh.err='Nenhum usuário encontrado. Confira o nome de usuário, o e-mail ou o ID e tente de novo.';
    else{
      const dup=S.shares.sent.find(x=>x.status==='pendente'&&x.workoutId===sh.wid&&x.to===r[0].id);
      if(dup)sh.err='Este treino já foi enviado para '+r[0].full_name+' e está aguardando resposta.';
      else sh.found=Object.assign({q:sh.q},r[0]);
    }
  }catch(e){sh.busy=false;sh.err=errMsg(e)}
  render();
}
async function shSend(){
  const sh=S.ui.shSheet;if(!sh||sh.busy||!sh.found||sh.found.q!==sh.q)return;
  const who=sh.found;
  sh.busy=true;sh.err='';render();
  try{await api.shareWorkout(sh.wid,who.id)}
  catch(e){sh.busy=false;sh.err=errMsg(e);render();return}
  try{await reloadShares()}catch(e){}
  S.ui.shSheet=null;render();toast('Convite enviado para '+who.full_name+'. Ele fica pendente até a pessoa aceitar.');
}
async function reloadAfterAccept(){
  await reloadWorkouts();await reloadExercises();
  try{const v=await api.loadVideos();S.videos={};v.forEach(x=>{S.videos[x.exerciseId]=x});cacheNow()}catch(e){}
}
async function shRespond(id,accept){
  if(S.ui.shBusy)return;
  S.ui.shBusy=true;render();
  let r=null,err=null;
  try{r=await api.respondShare(id,accept)}catch(e){err=e}
  if(!err&&accept&&r&&r.workout_id){try{await reloadAfterAccept()}catch(e){}}
  try{await reloadShares()}catch(e){}
  S.ui.shBusy=false;
  if(err){toast(errMsg(err),'bad');render();return}
  if(accept){
    S.seg.workouts='treinos';
    render();
    toast((r.already?'Este convite já tinha sido aceito.':'Treino adicionado em Meus treinos.')+(r.videos_skipped?' '+r.videos_skipped+' vídeo'+(r.videos_skipped>1?'s':'')+' enviado'+(r.videos_skipped>1?'s':'')+' como arquivo não '+(r.videos_skipped>1?'foram copiados':'foi copiado')+'.':''));
  }else{render();toast('Convite recusado.')}
}

const A_SH={
 shareOpen(d){
  const w=S.workouts.find(x=>x.id===d.id);if(!w)return;
  if(!(w.exercises||[]).length){toast('Este treino não tem exercícios para compartilhar.','bad');return}
  S.ui.shSheet={wid:w.id,name:w.name,count:(w.exercises||[]).length,q:'',busy:false,err:'',found:null};
  render();
  setTimeout(()=>{const i=$('#shQ');if(i)i.focus()},50);
 },
 shSheetClose(){shCloseSheet()},
 shSheetBg(d,el,ev){if(ev.target===el)shCloseSheet()},
 shSearch(){shSearch()},
 shSend(){once('shsend',shSend)},
 shAccept(d){once('shacc',()=>shRespond(d.id,true))},
 shDecline(d){once('shdec',()=>shRespond(d.id,false))},
 shCancel(d){once('shcan',async()=>{
  try{await api.cancelShare(d.id);await reloadShares();render();toast('Convite cancelado.')}
  catch(e){toast(errMsg(e),'bad');try{await reloadShares()}catch(_){}render()}
 })},
 shGoReceived(){S.tab='workouts';S.view='workouts';S.seg.workouts='recebidos';S.top=true;render()}
};
/* Enter na busca */
document.addEventListener('keydown',e=>{
  const t=e.target;
  if(e.key==='Enter'&&t&&t.dataset&&t.dataset.scope==='sh'){e.preventDefault();shSearch()}
  if(e.key==='Escape'&&S.ui&&S.ui.shSheet)shCloseSheet();
});
