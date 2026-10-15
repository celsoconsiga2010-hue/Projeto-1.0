'use strict';
/* ============ tema, tela acesa, armazenamento local ============ */
function applyTheme(t){
  t=t==='light'?'light':'dark';
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem('cds.theme',t)}catch(e){}
  const m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute('content',t==='light'?'#f0f5f3':'#0b1110');
}
function keepAwake(){try{if(navigator.wakeLock)navigator.wakeLock.request('screen').catch(()=>{})}catch(e){}}
const lsKey=()=>'cds.session.'+S.uid;
function localWrite(dirty){try{if(S.session)localStorage.setItem(lsKey(),JSON.stringify({s:S.session,dirty:!!dirty}));else localStorage.removeItem(lsKey())}catch(e){}}
function localRead(){try{const v=localStorage.getItem(lsKey());return v?JSON.parse(v):null}catch(e){return null}}
async function once(key,fn){const k='busy_'+key;if(S.ui[k])return;S.ui[k]=true;try{await fn()}finally{S.ui[k]=false}}
async function safe(fn,okMsg){try{await fn();if(okMsg)toast(okMsg);return true}catch(e){toast(errMsg(e),'bad');return false}}

/* ============ autosave do treino em andamento ============
   Cada toque grava primeiro no aparelho e depois no Supabase (com retentativa).
   Sem internet o treino continua funcionando e sincroniza quando a conexão volta. */
const SY={timer:null,busy:false,again:false,retry:null};
function persist(){
  if(!S.session)return;
  S.session.updatedAt=new Date().toISOString();
  localWrite(true);setSync('saving');
  clearTimeout(SY.timer);SY.timer=setTimeout(syncNow,600);
}
async function syncNow(){
  if(!S.session||!sb)return;
  if(SY.busy){SY.again=true;return}
  SY.busy=true;const snap=clone(S.session);
  try{
    await api.saveDraft(snap);
    if(S.session&&S.session.id===snap.id&&S.session.updatedAt===snap.updatedAt){localWrite(false);setSync('saved')}else SY.again=true;
  }catch(e){
    setSync('error');clearTimeout(SY.retry);SY.retry=setTimeout(syncNow,6000);
  }finally{
    SY.busy=false;
    if(SY.again){SY.again=false;clearTimeout(SY.timer);SY.timer=setTimeout(syncNow,150)}
  }
}
async function syncIdle(){clearTimeout(SY.timer);clearTimeout(SY.retry);let n=0;while(SY.busy&&n++<150)await sleep(100)}

/* ============ sessão de treino ============ */
function startSession(wid){
  if(S.session){if(S.session.workoutId!==wid)toast('Finalize ou descarte o treino em andamento antes de iniciar outro.');go('session');return}
  const w=S.workouts.find(x=>x.id===wid);if(!w)return;
  const now=new Date(),id=uuid();
  const exercises=(w.exercises||[]).map(we=>{
    const ex=exById(we.exerciseId),planned={sets:we.sets||3,repMin:we.repMin||8,repMax:we.repMax||12,load:we.load==null?'':we.load,rest:we.rest||restDefault(),inc:we.inc==null?2.5:we.inc};
    const last=lastEntry(we.exerciseId),sets=[];
    for(let j=0;j<planned.sets;j++){const ls=last&&(last.sets[j]||last.sets[last.sets.length-1]);sets.push({load:ls?String(ls.load):(planned.load===''?'':String(planned.load)),reps:'',done:false})}
    const sg=suggest(we.exerciseId,planned);
    return {exerciseId:we.exerciseId,name:(ex&&ex.name)||we.name,group:(ex&&ex.group)||we.group||'',planned:planned,sets:sets,notes:'',sug:sg?Object.assign(sg,{status:'pending'}):null};
  });
  S.session={id:id,workoutId:w.id,workoutName:w.name,date:ymd(now),startedAt:now.toISOString(),status:'em_andamento',notes:'',exercises:exercises};
  S.ui.confirmFinish=false;S.ui.confirmDiscard=false;S.ui.sugEdit=null;S.rest=null;
  persist();keepAwake();go('session',{tab:'workouts'});
}
async function applySug(i,val){
  const ex=S.session.exercises[i];
  ex.sets.forEach(s=>{if(!s.done)s.load=String(val)});ex.sug.status='accepted';ex.sug.applied=val;persist();
  S.ui.sugEdit=null;render();
  const w=S.workouts.find(x=>x.id===S.session.workoutId),we=w&&(w.exercises||[]).find(e=>e.exerciseId===ex.exerciseId);
  if(we){try{await api.setLoad(w.id,ex.exerciseId,val);we.load=val;toast('Carga de referência do treino atualizada.')}catch(e){toast(errMsg(e),'bad')}}
}
async function finishSession(){
  const ses=clone(S.session);
  const done=e=>e.sets.filter(s=>s.done&&num(s.reps)>0).map(s=>({load:num(s.load),reps:Math.round(num(s.reps))}));
  const exs=ses.exercises.map(e=>({exercise_id:e.exerciseId,name:e.name,group:e.group||'',planned_sets:e.planned.sets,planned_rep_min:e.planned.repMin,planned_rep_max:e.planned.repMax,
    planned_load:e.planned.load===''||e.planned.load==null?null:num(e.planned.load),notes:e.notes||'',sets:done(e)})).filter(e=>e.sets.length);
  if(!exs.length){S.ui.finErr='Conclua ao menos uma série, com repetições, antes de finalizar.';render();return}
  const ended=new Date(),dsec=Math.round((ended-new Date(ses.startedAt))/1000);
  await syncIdle();
  try{
    await api.finishSession({id:ses.id,workout_id:ses.workoutId,workout_name:ses.workoutName,session_date:ses.date,started_at:ses.startedAt,ended_at:ended.toISOString(),duration_seconds:dsec,notes:ses.notes||'',exercises:exs});
  }catch(e){S.ui.finErr=errMsg(e)+' O treino continua salvo no aparelho.';render();return}
  const fin={id:ses.id,workoutId:ses.workoutId,workoutName:ses.workoutName,date:ses.date,startedAt:ses.startedAt,endedAt:ended.toISOString(),durationSec:dsec,notes:ses.notes||'',status:'concluida',
    exercises:ses.exercises.map(e=>({exerciseId:e.exerciseId,name:e.name,group:e.group,planned:e.planned,notes:e.notes||'',sets:done(e).map(s=>({load:s.load,reps:s.reps,done:true}))})).filter(e=>e.sets.length)};
  fin.volume=sesVolume(fin);
  S.sessions=S.sessions.filter(x=>x.id!==fin.id);S.sessions.unshift(fin);
  S.session=null;localWrite(false);S.rest=null;S.ui.confirmFinish=false;S.ui.finErr='';S.sel=fin.id;
  cacheNow();go('sdetail',{tab:'history'});toast('Treino finalizado. Bom trabalho!');
}
function restDone(quiet){
  if(!S.rest)return;S.rest=null;clearTimeout(S.restT);
  const rb=$('#restbar');if(rb)rb.remove();
  try{if(navigator.vibrate)navigator.vibrate(300)}catch(e){}
  if(quiet)return;
  toast('Descanso terminado. Próxima série!');
  if(S.profile&&S.profile.notifications&&document.hidden&&('Notification' in window)&&Notification.permission==='granted'){
    try{navigator.serviceWorker.ready.then(r=>r.showNotification('Descanso terminado',{body:'Hora da próxima série.',icon:'icons/icon-192.png',tag:'rest'})).catch(()=>{})}catch(e){}
  }
}

/* ============ treinos e exercícios ============ */
const ints=(v,d)=>Math.max(1,Math.round(num(v))||d);
const exPayload=e=>({exercise_id:e.exerciseId,sets:ints(e.sets,3),rep_min:ints(e.repMin,8),rep_max:ints(e.repMax,12),load:(e.load===''||e.load==null)?null:num(e.load),rest_seconds:Math.max(0,Math.round(num(e.rest))||restDefault()),progression_inc:e.inc==null?2.5:Number(e.inc),notes:e.notes||''});
async function reloadWorkouts(){S.workouts=await api.loadWorkouts(exById);cacheNow()}
async function reloadExercises(){S.exercises=await api.loadCustomExercises();cacheNow()}
async function saveWorkout(){
  const w=S.draft.w,name=(w.name||'').trim();
  if(!name){S.ui.wErr='Dê um nome ao treino.';render();return}
  if(!w.exercises.length){S.ui.wErr='Adicione ao menos um exercício.';render();return}
  const exs=w.exercises.map(exPayload);
  if(exs.some(e=>e.rep_max<e.rep_min)){S.ui.wErr='Em algum exercício as repetições máximas são menores que as mínimas.';render();return}
  const payload={id:S.draft.isNew?undefined:w.id,name:name,description:(w.description||'').trim(),goal:w.goal||'',muscles:w.muscles||[],notes:w.notes||'',exercises:exs};
  try{await api.saveWorkout(payload);await reloadWorkouts()}catch(e){S.ui.wErr=errMsg(e);render();return}
  S.ui.wErr='';S.ui.picker=null;toast('Treino salvo.');go('workouts',{tab:'workouts'});
}
async function saveExercise(){
  const x=S.draft.e,name=(x.name||'').trim();
  if(!name||!x.group||!x.equip){S.ui.eErr='Preencha nome, grupo muscular e equipamento.';render();return}
  const row={name:name,muscle_group:x.group,equipment:x.equip,secondary_groups:(x.secondary||[]).filter(g=>g!==x.group),description:(x.desc||'').trim(),notes:(x.notes||'').trim()};
  try{if(S.draft.isNew)await api.insertExercise(row);else await api.updateExercise(x.id,row);await reloadExercises()}
  catch(e){S.ui.eErr=e&&e.code==='23505'?'Você já tem um exercício com esse nome.':errMsg(e);render();return}
  S.ui.eErr='';S.seg.workouts='exercicios';toast('Exercício salvo.');go('workouts',{tab:'workouts'});
}
const SAMPLES=[
 {name:'Treino A',goal:'Hipertrofia',muscles:['Peito','Tríceps'],day:1,description:'Exemplo editável: peito e tríceps.',ex:['Supino reto com barra','Supino inclinado com halteres','Crucifixo na máquina (peck deck)','Tríceps na polia (corda)','Tríceps testa com barra']},
 {name:'Treino B',goal:'Hipertrofia',muscles:['Costas','Bíceps'],day:2,description:'Exemplo editável: costas e bíceps.',ex:['Puxada frontal na polia','Remada curvada com barra','Remada baixa na polia','Rosca direta com barra','Rosca martelo']},
 {name:'Treino C',goal:'Hipertrofia',muscles:['Quadríceps','Posterior de coxa','Panturrilha'],day:3,description:'Exemplo editável: pernas.',ex:['Agachamento livre','Leg press 45°','Cadeira extensora','Mesa flexora','Panturrilha em pé na máquina']}
];
async function seedExamples(){
  const sched=Object.assign({},S.profile.schedule||{});
  try{
    for(const t of SAMPLES){
      const exs=t.ex.map((n,i)=>{const e=stdBySlug(slug(n));return e?{exerciseId:e.id,sets:i===0?4:3,repMin:8,repMax:12,load:'',rest:restDefault(),inc:2.5,notes:''}:null}).filter(Boolean).map(exPayload);
      const id=await api.saveWorkout({name:t.name,description:t.description,goal:t.goal,muscles:t.muscles,notes:'',exercises:exs});
      if(!sched['d'+t.day])sched['d'+t.day]=id;
    }
    await api.saveProfile({schedule:sched});S.profile.schedule=sched;await reloadWorkouts();
    toast('Três treinos de exemplo criados e programados de segunda a quarta. Edite como quiser.');
  }catch(e){toast(errMsg(e),'bad');try{await reloadWorkouts()}catch(_){}}
  softRender();
}
function exportCsv(){
  const R=S.ui.rep||{period:'90'},D=repData(R).slice().reverse(),rows=[['Data','Treino','Exercício','Grupo muscular','Série','Carga ('+unit()+')','Repetições','Volume']];
  D.forEach(x=>x.exs.forEach(e=>setsDone(e).forEach((s,j)=>rows.push([fmtDate(x.s.date),x.s.workoutName,e.name,e.group||'',j+1,String(num(s.load)).replace('.',','),s.reps,String(Math.round(num(s.load)*num(s.reps)*100)/100).replace('.',',')]))));
  if(rows.length===1){toast('Não há séries neste filtro para exportar.');return}
  const csv=rows.map(r=>r.map(c=>{const v=String(c);return /[;"\n]/.test(v)?'"'+v.replace(/"/g,'""')+'"':v}).join(';')).join('\r\n');
  downloadFile('cds-fitness-treinos-'+todayStr()+'.csv','﻿'+csv);toast('Arquivo exportado.');
}

/* ============ cópia local (abrir sem internet) ============ */
let cacheT=null;
function cacheNow(){
  clearTimeout(cacheT);
  cacheT=setTimeout(()=>{if(!S.uid||!S.profile||S.offlineData)return;api.cacheSave(S.uid,{profile:S.profile,stdEx:S.stdEx,exercises:S.exercises,workouts:S.workouts,sessions:S.sessions,active:null,email:S.email,ts:Date.now()})},400);
}

/* ============ autenticação ============ */
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,USER_RE=/^[a-z0-9_.-]{3,24}$/;
const pwProblem=p=>!p||p.length<8?'A senha precisa ter ao menos 8 caracteres.':(!/[A-Za-z]/.test(p)||!/\d/.test(p)?'A senha precisa ter letras e números.':'');
const redirectUrl=()=>{if(!/^https?:$/.test(location.protocol)&&CFG.WEB_URL)return CFG.WEB_URL;try{return new URL('./',location.href).href}catch(e){return location.origin+'/'}};
function authErr(e){
  const m=String((e&&e.message)||''),c=String((e&&(e.code||e.error_code))||''),st=e&&e.status;
  if(isNetErr(e))return 'Sem conexão. Verifique a internet e tente de novo.';
  if(/invalid login credentials/i.test(m))return 'Usuário, e-mail ou senha incorretos.';
  if(/email not confirmed/i.test(m)||c==='email_not_confirmed')return 'Confirme seu e-mail antes de entrar. Procure o link na sua caixa de entrada.';
  if(/already registered|already been registered/i.test(m)||c==='user_already_exists')return 'Este e-mail já está cadastrado. Entre ou recupere a senha.';
  if(/rate limit|too many/i.test(m)||st===429||/rate_limit/.test(c))return 'Muitas tentativas. Aguarde alguns minutos e tente de novo.';
  if(/database error saving new user/i.test(m))return 'Não foi possível criar a conta. O nome de usuário pode já estar em uso.';
  if(/password/i.test(m)&&/(least|weak|short|characters)/i.test(m))return 'A senha é fraca. Use ao menos 8 caracteres, com letras e números.';
  if(/same password|different from the old/i.test(m))return 'A nova senha precisa ser diferente da atual.';
  if(/session|jwt/i.test(m)&&/missing|expired/i.test(m))return 'O link expirou. Peça um novo em "Esqueci minha senha".';
  return 'Não foi possível concluir. Tente de novo.';
}
function resetState(){
  clearTimeout(SY.timer);clearTimeout(SY.retry);clearTimeout(S.restT);
  Object.assign(S,{uid:null,email:'',profile:null,stdEx:[],exercises:[],workouts:[],sessions:[],session:null,rest:null,draft:null,sel:null,ui:{},view:'home',tab:'home',offlineData:false,rendered:false,loading:false,errMsg:''});
}
function toSignedOut(info){
  resetState();S.boot='auth';S.auth={mode:'login',f:{},err:'',info:info||'',busy:false};render();
}
function applyData(d){S.profile=d.profile;S.stdEx=d.stdEx;S.exercises=d.exercises;S.workouts=d.workouts;S.sessions=d.sessions}
function bootWith(d){
  applyData(d);S.session=null;S.lastLoad=Date.now();
  const loc=localRead(),remote=d.active,already=loc&&loc.s&&d.sessions.some(x=>x.id===loc.s.id);
  let dirty=false;
  if(loc&&loc.s&&loc.dirty&&!already){S.session=loc.s;dirty=true}
  else if(remote&&!S.discarded[remote.id]&&!d.sessions.some(x=>x.id===remote.id))S.session=remote;
  localWrite(dirty);
  applyTheme(S.profile.theme);
  S.boot='ready';S.view='home';S.tab='home';S.draft=null;S.top=true;S.loading=false;render();
  if(S.session&&dirty&&!S.offlineData)syncNow();
}
async function loadApp(user){
  if(S.loading)return;S.loading=true;
  S.uid=user.id;S.email=user.email||'';S.boot='loading';render();
  let data;
  try{data=await api.loadAll(S.uid);data.email=S.email;api.cacheSave(S.uid,data);S.offlineData=false}
  catch(e){
    const c=isNetErr(e)?api.cacheLoad(S.uid):null;
    if(c){data=c;S.offlineData=true}
    else{S.boot='error';S.errMsg=e&&e.code==='NOPROFILE'?e.message:errMsg(e);S.loading=false;render();return}
  }
  bootWith(data);
}
async function tryOffline(){
  let uid=null;try{uid=localStorage.getItem('cds.lastuid')}catch(e){}
  const c=uid&&api.cacheLoad(uid);if(!c)return false;
  S.uid=uid;S.email=c.email||'';S.offlineData=true;bootWith(c);return true;
}
async function onAuth(event,session){
  S.authSeen=true;
  if(event==='PASSWORD_RECOVERY'){S.recovering=true;S.boot='auth';S.auth={mode:'reset',f:{},err:'',info:'',busy:false};render();return}
  if(S.recovering)return;
  if(session&&session.user){
    if(S.uid===session.user.id&&(S.boot==='ready'||S.boot==='loading'||S.loading)&&!S.offlineData)return;
    S.offlineData=false;S.uid=null;
    await loadApp(session.user);return;
  }
  if(event==='INITIAL_SESSION'&&!navigator.onLine&&await tryOffline())return;
  if(S.uid||S.boot!=='auth'||S.auth.mode==='setup')toSignedOut(S.auth.info);
}
async function submitAuth(){
  if(S.auth.busy)return;
  const f=S.auth.f,m=S.auth.mode;S.auth.err='';S.auth.info='';
  const fail=msg=>{S.auth.err=msg;S.auth.busy=false;render()};
  const start=()=>{S.auth.busy=true;render()};
  const email=(f.email||'').trim(),pw=f.pw||'';
  try{
    if(m==='login'){
      const id=(f.id||'').trim();
      if(!id||!pw)return fail('Informe o usuário ou e-mail e a senha.');
      start();let addr=id;
      if(!id.includes('@')){
        if(CFG.allowUsernameLogin===false)return fail('Informe o e-mail da conta.');
        addr=await api.emailForUsername(id);
        if(!addr)return fail('Usuário, e-mail ou senha incorretos.');
      }
      const r=await sb.auth.signInWithPassword({email:addr,password:pw});
      if(r.error)throw r.error;
      S.auth.busy=false;
      if(r.data&&r.data.session)onAuth('SIGNED_IN',r.data.session);
    }else if(m==='signup'){
      const name=(f.name||'').trim(),user=(f.user||'').trim().toLowerCase();
      if(!name)return fail('Informe seu nome completo.');
      if(!USER_RE.test(user))return fail('Nome de usuário: 3 a 24 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado.');
      if(!EMAIL_RE.test(email))return fail('Informe um e-mail válido.');
      const pp=pwProblem(pw);if(pp)return fail(pp);
      if(pw!==f.pw2)return fail('A confirmação da senha não confere.');
      start();
      if(!await api.usernameAvailable(user))return fail('Este nome de usuário já está em uso. Escolha outro.');
      const r=await sb.auth.signUp({email:email,password:pw,options:{data:{full_name:name,username:user},emailRedirectTo:redirectUrl()}});
      if(r.error)throw r.error;
      if(r.data&&r.data.user&&Array.isArray(r.data.user.identities)&&r.data.user.identities.length===0)return fail('Este e-mail já está cadastrado. Entre ou recupere a senha.');
      S.auth.busy=false;
      if(r.data&&r.data.session){onAuth('SIGNED_IN',r.data.session);return}
      S.auth.mode='confirm';S.auth.f={email:email};render();
    }else if(m==='forgot'){
      if(!EMAIL_RE.test(email))return fail('Informe um e-mail válido.');
      start();
      const r=await sb.auth.resetPasswordForEmail(email,{redirectTo:redirectUrl()});
      if(r.error)throw r.error;
      S.auth.busy=false;S.auth.info='Se esse e-mail estiver cadastrado, enviamos um link para criar uma nova senha. Confira também o spam.';render();
    }else if(m==='reset'){
      const pp=pwProblem(pw);if(pp)return fail(pp);
      if(pw!==f.pw2)return fail('A confirmação da senha não confere.');
      start();
      const r=await sb.auth.updateUser({password:pw});
      if(r.error)throw r.error;
      S.recovering=false;S.auth.busy=false;toast('Senha alterada.');
      const g=await sb.auth.getSession();
      if(g.data&&g.data.session)await loadApp(g.data.session.user);else toSignedOut('Senha alterada. Entre com a nova senha.');
    }
  }catch(e){fail(authErr(e))}
}
async function doSignOut(){
  const uid=S.uid,loc=localRead();
  await syncIdle();
  try{await sb.auth.signOut({scope:'local'})}catch(e){}
  if(uid){api.cacheClear(uid);if(!(loc&&loc.dirty)){try{localStorage.removeItem('cds.session.'+uid)}catch(e){}}}
  toSignedOut();
}

/* ============ ações (cliques) ============ */
const A={
 tab(d){S.tab=d.v;S.view=d.v;S.ui.delW=S.ui.delE=S.ui.delS=null;S.ui.wipe=false;S.ui.confirmOut=false;if(d.v==='profile'){S.draft={p:profileDraft(),pw:{a:'',b:''}};S.ui.pErr='';S.ui.pwErr=''}S.top=true;render()},
 retry(){
  if(!sb){init();return}
  S.loading=false;S.boot='loading';render();
  sb.auth.getSession().then(r=>{const s=r.data&&r.data.session;if(s&&s.user){S.uid=null;loadApp(s.user)}else toSignedOut()}).catch(()=>{S.boot='error';S.errMsg='Sem conexão. Tente de novo.';render()});
 },
 signOutNow(){doSignOut()},
 resume(){go('session',{tab:'workouts'});keepAwake()},
 leaveSession(){go('home',{tab:'home'})},
 startW(d){startSession(d.id)},
 startQuick(){const v=$('#quickW');if(v&&v.value)startSession(v.value)},
 segW(d){S.seg.workouts=d.v;S.ui.delW=S.ui.delE=null;render()},
 segH(d){S.seg.history=d.v;render()},
 segM(d){S.ui.evo.metric=d.v;render()},
 openSession(d){S.sel=d.id;S.ui.delS=null;go('sdetail',{tab:'history'})},
 backHist(){go('history',{tab:'history'})},
 exEvo(d){S.ui.evo=Object.assign({period:'all',from:'',to:'',metric:'load',gran:'sessao'},S.ui.evo||{},{exId:d.id,a:'',b:'',period:'all'});S.seg.history='evolucao';go('history',{tab:'history'})},
 seedExamples(){once('seed',seedExamples)},
 /* autenticação */
 authMode(d){S.auth.mode=d.v;S.auth.err='';S.auth.info='';S.auth.busy=false;delete S.auth.f.pw;delete S.auth.f.pw2;render()},
 togglePw(d,el){const i=document.getElementById(d.for);if(!i)return;const show=i.type==='password';i.type=show?'text':'password';el.textContent=show?'Ocultar':'Mostrar';el.setAttribute('aria-label',show?'Ocultar senha':'Mostrar senha')},
 askSignOut(){const l=localRead();S.ui.outWarn=!!(l&&l.dirty);S.ui.confirmOut=true;render()},
 cancelSignOut(){S.ui.confirmOut=false;render()},
 signOut(){doSignOut()},
 async changePw(){
  const pw=S.draft.pw,pp=pwProblem(pw.a);
  if(pp){S.ui.pwErr=pp;render();return}
  if(pw.a!==pw.b){S.ui.pwErr='A confirmação da senha não confere.';render();return}
  await once('pw',async()=>{
    const r=await sb.auth.updateUser({password:pw.a});
    if(r.error){S.ui.pwErr=authErr(r.error);render();return}
    S.ui.pwErr='';S.draft.pw={a:'',b:''};render();toast('Senha alterada.');
  });
 },
 async install(){const e=S.installEvt;if(!e)return;try{e.prompt();await e.userChoice}catch(_){}S.installEvt=null;render()},
 /* treinos */
 newWorkout(){S.draft={isNew:true,w:{name:'',description:'',goal:'',muscles:[],notes:'',exercises:[]}};S.ui.wErr='';S.ui.picker=null;go('wform',{tab:'workouts'})},
 editWorkout(d){const w=S.workouts.find(x=>x.id===d.id);if(!w)return;S.draft={isNew:false,w:clone(w)};S.ui.wErr='';S.ui.picker=null;go('wform',{tab:'workouts'})},
 dupWorkout(d){once('dup',async()=>{
  const w=S.workouts.find(x=>x.id===d.id);if(!w)return;
  if(await safe(async()=>{await api.saveWorkout({name:(w.name+' (cópia)').slice(0,80),description:w.description,goal:w.goal,muscles:w.muscles,notes:w.notes,exercises:w.exercises.map(exPayload)});await reloadWorkouts()},'Treino duplicado.'))softRender();
 })},
 askDelW(d){S.ui.delW=d.id;render()},cancelDel(){S.ui.delW=S.ui.delE=S.ui.delS=null;render()},
 delWorkout(d){once('delw',async()=>{
  const sc=Object.assign({},S.profile.schedule||{});Object.keys(sc).forEach(k=>{if(sc[k]===d.id)sc[k]=''});
  S.ui.delW=null;
  const ok=await safe(()=>api.deleteWorkout(d.id),'Treino excluído. O histórico foi mantido.');
  if(ok){S.workouts=S.workouts.filter(w=>w.id!==d.id);S.profile.schedule=sc;cacheNow();await safe(()=>api.saveProfile({schedule:sc}))}
  softRender();
 })},
 toggleMuscle(d){const m=S.draft.w.muscles=S.draft.w.muscles||[],i=m.indexOf(d.v);if(i>=0)m.splice(i,1);else m.push(d.v);render()},
 openPicker(){S.ui.picker={q:'',g:''};render()},
 closePicker(){S.ui.picker=null;render()},
 closePickerBg(d,el,ev){if(ev.target===el){S.ui.picker=null;render()}},
 pick(d){const ex=exById(d.id);if(!ex)return;const w=S.draft.w;if(w.exercises.some(e=>e.exerciseId===ex.id)){toast('Esse exercício já está no treino.');return}
  w.exercises.push({exerciseId:ex.id,name:ex.name,group:ex.group,sets:3,repMin:8,repMax:12,load:'',rest:restDefault(),inc:2.5,notes:''});
  const l=$('#pkList');if(l)l.innerHTML=pickerList();toast('Adicionado: '+ex.name)},
 exUp(d){const a=S.draft.w.exercises,i=+d.i;if(i>0){const t=a[i];a[i]=a[i-1];a[i-1]=t;render()}},
 exDown(d){const a=S.draft.w.exercises,i=+d.i;if(i<a.length-1){const t=a[i];a[i]=a[i+1];a[i+1]=t;render()}},
 exRemove(d){S.draft.w.exercises.splice(+d.i,1);render()},
 saveWorkout(){once('sw',saveWorkout)},
 cancelForm(){S.ui.picker=null;go('workouts',{tab:'workouts'})},
 /* exercícios */
 newExercise(){S.draft={isNew:true,e:{name:'',group:'',equip:'',secondary:[],desc:'',notes:''}};S.ui.eErr='';go('eform',{tab:'workouts'})},
 editExercise(d){const e=S.exercises.find(x=>x.id===d.id);if(!e)return;S.draft={isNew:false,e:clone(e)};S.ui.eErr='';go('eform',{tab:'workouts'})},
 toggleSecondary(d){const s=S.draft.e.secondary=S.draft.e.secondary||[],i=s.indexOf(d.v);if(i>=0)s.splice(i,1);else s.push(d.v);render()},
 saveExercise(){once('se',saveExercise)},
 askDelE(d){S.ui.delE=d.id;render()},
 delExercise(d){once('dele',async()=>{S.ui.delE=null;if(await safe(()=>api.archiveExercise(d.id),'Exercício excluído. O histórico foi mantido.')){const e=S.exercises.find(x=>x.id===d.id);if(e)e.archived=true;cacheNow()}softRender()})},
 /* sugestões de progressão */
 sugAccept(d){applySug(+d.ex,S.session.exercises[+d.ex].sug.suggested)},
 sugEdit(d){S.ui.sugEdit=+d.ex;S.ui.sugVal=S.session.exercises[+d.ex].sug.suggested;render()},
 sugCancelEdit(){S.ui.sugEdit=null;render()},
 sugApplyEdit(d){const v=num(S.ui.sugVal);if(v<0)return;applySug(+d.ex,v)},
 sugIgnore(d){S.session.exercises[+d.ex].sug.status='ignored';persist();render()},
 /* execução */
 toggleSet(d){
  const ex=S.session.exercises[+d.ex],s=ex.sets[+d.set];
  if(!s.done){
    if(num(s.reps)<=0){toast('Informe as repetições antes de concluir a série.');const el=document.querySelector('input[data-f="reps"][data-ex="'+d.ex+'"][data-set="'+d.set+'"]');if(el)el.focus();return}
    s.done=true;S.rest={endsAt:Date.now()+ex.planned.rest*1000};clearTimeout(S.restT);S.restT=setTimeout(()=>restDone(),ex.planned.rest*1000+300);
  }else s.done=false;
  persist();render();
 },
 addSet(d){const ex=S.session.exercises[+d.ex],l=ex.sets[ex.sets.length-1];ex.sets.push({load:l?l.load:'',reps:'',done:false});persist();render()},
 rmSet(d){const ex=S.session.exercises[+d.ex];if(ex.sets.length>1){ex.sets.pop();persist();render()}},
 skipRest(){restDone(true)},
 askFinish(){S.ui.confirmFinish=true;S.ui.finErr='';render()},
 cancelFinish(){S.ui.confirmFinish=false;render()},
 finish(){once('fin',finishSession)},
 askDiscard(){S.ui.confirmDiscard=true;render()},cancelDiscard(){S.ui.confirmDiscard=false;render()},
 discard(){once('disc',async()=>{
  const id=S.session.id;await syncIdle();
  try{await api.deleteSession(id)}catch(e){toast(errMsg(e),'bad');return}
  S.discarded[id]=true;S.session=null;localWrite(false);S.rest=null;S.ui.confirmDiscard=false;go('home',{tab:'home'});toast('Treino descartado.');
 })},
 /* histórico */
 askDelS(d){S.ui.delS=d.id;render()},
 delSession(d){once('dels',async()=>{S.ui.delS=null;if(await safe(()=>api.deleteSession(d.id),'Sessão excluída.')){S.sessions=S.sessions.filter(s=>s.id!==d.id);cacheNow();go('history',{tab:'history'})}else render()})},
 exportCsv(){exportCsv()},
 printReport(){try{window.print()}catch(e){toast('Não foi possível abrir a impressão neste aparelho.','bad')}},
 /* perfil */
 theme(){const t=document.documentElement.getAttribute('data-theme')==='light'?'dark':'light';applyTheme(t);S.profile.theme=t;api.saveProfile({theme:t}).catch(()=>{});render()},
 savePf(){once('pf',async()=>{
  const p=S.draft.p,name=(p.name||'').trim(),un=(p.username||'').trim().toLowerCase(),wg=Math.round(num(p.weekGoal)),rs=Math.round(num(p.rest));
  let e='';
  if(!name)e='Informe seu nome.';else if(!USER_RE.test(un))e='Nome de usuário: 3 a 24 caracteres, só letras minúsculas, números, ponto, hífen ou sublinhado.';
  else if(wg<1||wg>7)e='A meta semanal vai de 1 a 7 treinos.';else if(rs<10||rs>600)e='O descanso padrão vai de 10 a 600 segundos.';
  if(e){S.ui.pErr=e;render();return}
  const patch={name:name,username:un,goal:p.goal||'',startDate:p.startDate||'',weekGoal:wg,rest:rs,unit:p.unit||'kg',notifications:!!p.notifications};
  try{await api.saveProfile(patch)}catch(err){S.ui.pErr=err&&err.code==='23505'?'Esse nome de usuário já está em uso.':errMsg(err);render();return}
  Object.assign(S.profile,patch);S.ui.pErr='';S.draft.p=profileDraft();cacheNow();render();toast('Perfil atualizado.');
 })},
 askWipe(){S.ui.wipe=true;render()},cancelWipe(){S.ui.wipe=false;render()},
 wipe(){once('wipe',async()=>{
  S.ui.wipe=false;
  if(await safe(()=>api.wipeSessions(),'Histórico apagado.')){S.sessions=[];S.session=null;S.rest=null;localWrite(false);cacheNow()}
  render();
 })}
};
document.addEventListener('click',e=>{
  const pt=e.target.closest&&e.target.closest('.pt');if(pt){showTip(pt);return}
  const el=e.target.closest&&e.target.closest('[data-act]');if(!el||!$('#app').contains(el))return;
  const fn=A[el.dataset.act];if(fn){e.preventDefault();fn(el.dataset,el,e)}
});
document.addEventListener('submit',e=>{if(e.target&&e.target.id==='authForm'){e.preventDefault();submitAuth()}});

/* ============ seletores e campos ============ */
const C={
 sched(t){const k='d'+t.dataset.d,sc=Object.assign({},S.profile.schedule||{});sc[k]=t.value;
  api.saveProfile({schedule:sc}).then(()=>{S.profile.schedule=sc;cacheNow();toast('Programação salva.')}).catch(e=>{toast(errMsg(e),'bad');softRender()})},
 catFilter(t){S.ui[t.dataset.f]=t.value;$('#catList').innerHTML=catList()},
 wfInc(t){S.draft.w.exercises[+t.dataset.i].inc=Number(t.value)},
 wfGoal(t){S.draft.w.goal=t.value},
 efSel(t){S.draft.e[t.dataset.f]=t.value;if(t.dataset.f==='group')render()},
 pkG(t){S.ui.picker.g=t.value;$('#pkList').innerHTML=pickerList()},
 histF(t){S.ui.hist[t.dataset.f]=t.value;render()},
 evoF(t){const E=S.ui.evo;E[t.dataset.f]=t.value;if(t.dataset.f==='exId'){E.a='';E.b=''}render()},
 evoCmp(t){S.ui.evo[t.dataset.w]=t.value;render()},
 repF(t){S.ui.rep[t.dataset.f]=t.value;render()},
 pfSel(t){S.draft.p[t.dataset.f]=t.value},
 async pfNotif(t){
  if(t.checked&&'Notification' in window){
    let perm=Notification.permission;
    if(perm==='default'){try{perm=await Notification.requestPermission()}catch(e){}}
    if(perm!=='granted'){t.checked=false;S.draft.p.notifications=false;toast('Permissão negada. Ative as notificações nas configurações do navegador.');return}
  }
  S.draft.p.notifications=t.checked;
 }
};
document.addEventListener('change',e=>{const t=e.target,k=t.dataset&&t.dataset.chg;if(k&&C[k])C[k](t)});
document.addEventListener('input',e=>{
  const t=e.target,sc=t.dataset&&t.dataset.scope;if(!sc)return;const f=t.dataset.f,v=t.value;
  if(sc==='au')S.auth.f[f]=v;
  else if(sc==='cat'){S.ui.catQ=v;$('#catList').innerHTML=catList()}
  else if(sc==='pk'){S.ui.picker.q=v;$('#pkList').innerHTML=pickerList()}
  else if(sc==='wf0')S.draft.w[f]=v;
  else if(sc==='wf')S.draft.w.exercises[+t.dataset.i][f]=v;
  else if(sc==='ef')S.draft.e[f]=v;
  else if(sc==='pf')S.draft.p[f]=v;
  else if(sc==='pw')S.draft.pw[f]=v;
  else if(sc==='sugv')S.ui.sugVal=v;
  else if(sc==='ses'&&S.session){
    const ses=S.session;
    if(f==='notes')ses.notes=v;
    else{const ex=ses.exercises[+t.dataset.ex];if(f==='exnotes')ex.notes=v;else ex.sets[+t.dataset.set][f]=v}
    persist();
  }
});

/* dicas dos gráficos */
function showTip(pt){const ch=pt.closest('.chart');if(!ch)return;const tip=ch.querySelector('.tip');tip.textContent=pt.dataset.tip;tip.hidden=false;const r=pt.getBoundingClientRect(),c=ch.getBoundingClientRect();tip.style.left=(r.left+r.width/2-c.left)+'px';tip.style.top=(r.top-c.top-4)+'px'}
document.addEventListener('pointerover',e=>{const pt=e.target.closest&&e.target.closest('.pt');if(pt)showTip(pt)});
document.addEventListener('pointerout',e=>{const pt=e.target.closest&&e.target.closest('.pt');if(pt){const tip=pt.closest('.chart').querySelector('.tip');tip.hidden=true}});
document.addEventListener('pointerdown',e=>{if(!(e.target.closest&&e.target.closest('.pt')))document.querySelectorAll('.tip').forEach(t=>{t.hidden=true})});

/* cronômetros */
setInterval(()=>{
  if(S.view!=='session'||!S.session)return;
  const el=$('#elapsed');if(el)el.textContent=clock((Date.now()-new Date(S.session.startedAt))/1000);
  if(S.rest){const left=(S.rest.endsAt-Date.now())/1000;
    if(left<=0)restDone();else{const rt=$('#resttime');if(rt)rt.textContent=clock(left)}}
},1000);

/* ============ rede, foco, instalação ============ */
async function maybeRefresh(){
  if(S.boot!=='ready'||S.offlineData||!navigator.onLine||S.session||LOCK.includes(S.view)||S.refreshing||Date.now()-(S.lastLoad||0)<120000)return;
  S.refreshing=true;
  try{const d=await api.loadAll(S.uid);d.email=S.email;api.cacheSave(S.uid,d);applyData(d);S.lastLoad=Date.now();softRender()}catch(e){}
  S.refreshing=false;
}
document.addEventListener('visibilitychange',()=>{if(document.hidden)return;if(S.session&&S.view==='session')keepAwake();maybeRefresh()});
window.addEventListener('offline',()=>{S.online=false;softRender()});
window.addEventListener('online',async()=>{
  S.online=true;
  if(S.offlineData&&sb){
    try{const g=await sb.auth.getSession();if(g.data&&g.data.session&&g.data.session.user){S.offlineData=false;S.uid=null;await loadApp(g.data.session.user)}else toSignedOut('Entre de novo para sincronizar.')}catch(e){}
    return;
  }
  softRender();if(S.session)syncNow();
});
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();S.installEvt=e;if(S.boot==='ready'&&S.view==='profile'&&!/INPUT|TEXTAREA|SELECT/.test((document.activeElement||{}).tagName||''))render()});
window.addEventListener('appinstalled',()=>{S.installEvt=null;toast('App instalado.')});
let lastW=document.documentElement.clientWidth,rt;
window.addEventListener('resize',()=>{clearTimeout(rt);rt=setTimeout(()=>{const w=document.documentElement.clientWidth;if(Math.abs(w-lastW)>40){lastW=w;if(S.rendered&&S.boot==='ready'&&!LOCK.includes(S.view))render()}},250)});

/* ============ inicialização ============ */
async function init(){
  S.boot='loading';render();
  if(!configured()){S.boot='auth';S.auth.mode='setup';render();return}
  if(!window.supabase||!window.supabase.createClient){S.boot='auth';S.auth.mode='nolib';render();return}
  if(!sb){connect();sb.auth.onAuthStateChange((ev,s)=>setTimeout(()=>onAuth(ev,s),0))}
  try{const r=await sb.auth.getSession();if(!S.authSeen)onAuth('INITIAL_SESSION',r.data&&r.data.session)}
  catch(e){if(!S.authSeen)onAuth('INITIAL_SESSION',null)}
}
if('serviceWorker' in navigator&&/^https?:$/.test(location.protocol)){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(()=>{})});
}
init();
