'use strict';
/* ============ telas de autenticação ============ */
function brand(){return '<div class="brand" style="margin:0"><span class="logo">CDS</span>Fitness</div>'}
function afield(id,label,type,auto,extra){
  const v=S.auth.f[id]||'';
  return '<div class="field"><label for="au_'+id+'">'+label+'</label><input id="au_'+id+'" class="in" type="'+type+'" autocomplete="'+auto+'" data-scope="au" data-f="'+id+'" value="'+esc(v)+'"'+(extra||'')+'></div>';
}
function pwfield(id,label,auto){
  const v=S.auth.f[id]||'';
  return '<div class="field"><label for="au_'+id+'">'+label+'</label><div class="pwwrap"><input id="au_'+id+'" class="in" type="password" autocomplete="'+auto+'" data-scope="au" data-f="'+id+'" value="'+esc(v)+'"><button type="button" class="pwbtn" data-act="togglePw" data-for="au_'+id+'" aria-label="Mostrar senha">Mostrar</button></div></div>';
}
const authMsgs=()=>(S.auth.err?'<p class="errbox" role="alert">'+esc(S.auth.err)+'</p>':'')+(S.auth.info?'<p class="okbox" role="status">'+esc(S.auth.info)+'</p>':'');
function submitBtn(label,busy){return '<button class="btn primary lg" type="submit"'+(S.auth.busy?' disabled':'')+'>'+(S.auth.busy?busy:label)+'</button>'}
function vAuth(){
  const m=S.auth.mode,cfg=window.CDS_CONFIG||{};let h='';
  if(m==='setup'){
    h='<div><h1>Falta conectar o Supabase</h1><p class="muted" style="margin-top:8px">Este app guarda contas e treinos no seu projeto Supabase. Ele ainda não foi configurado.</p></div>'+
      '<ol class="steps small"><li>Crie um projeto em <code class="k">supabase.com</code>.</li><li>Rode o arquivo <code class="k">supabase/schema.sql</code> no SQL Editor.</li><li>Abra <code class="k">js/config.js</code> e cole a URL e a chave <b>anon</b> do projeto.</li><li>Publique de novo e recarregue esta página.</li></ol><p class="hint">O passo a passo completo está no README.</p>';
  }else if(m==='nolib'){
    h='<div><h1>Sem conexão</h1><p class="muted" style="margin-top:8px">Na primeira abertura o app precisa de internet para carregar. Conecte-se e tente de novo.</p></div><button class="btn primary lg" data-act="retry">Tentar de novo</button>';
  }else if(m==='signup'){
    h='<div><h1>Criar conta</h1><p class="muted" style="margin-top:8px">Seus treinos ficam ligados à sua conta e só você enxerga.</p></div>'+
      '<form id="authForm" novalidate>'+afield('name','Nome completo','text','name')+afield('user','Nome de usuário','text','username',' autocapitalize="none" autocorrect="off" spellcheck="false"')+'<span class="hint" style="margin-top:-8px">3 a 24 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.</span>'+
      afield('email','E-mail','email','email',' autocapitalize="none" inputmode="email"')+pwfield('pw','Senha','new-password')+'<span class="hint" style="margin-top:-8px">Mínimo de 8 caracteres, com letras e números.</span>'+pwfield('pw2','Confirmar senha','new-password')+
      authMsgs()+submitBtn('Cadastrar','Criando conta…')+'</form><button class="linkbtn" data-act="authMode" data-v="login">Já tenho conta. Entrar</button>';
  }else if(m==='forgot'){
    h='<div><h1>Recuperar senha</h1><p class="muted" style="margin-top:8px">Informe o e-mail da conta. Enviaremos um link para criar uma nova senha.</p></div>'+
      '<form id="authForm" novalidate>'+afield('email','E-mail','email','email',' autocapitalize="none" inputmode="email"')+authMsgs()+submitBtn('Enviar link','Enviando…')+'</form><button class="linkbtn" data-act="authMode" data-v="login">Voltar ao login</button>';
  }else if(m==='reset'){
    h='<div><h1>Nova senha</h1><p class="muted" style="margin-top:8px">Escolha uma senha nova para a sua conta.</p></div>'+
      '<form id="authForm" novalidate>'+pwfield('pw','Nova senha','new-password')+'<span class="hint" style="margin-top:-8px">Mínimo de 8 caracteres, com letras e números.</span>'+pwfield('pw2','Confirmar nova senha','new-password')+authMsgs()+submitBtn('Salvar nova senha','Salvando…')+'</form>';
  }else if(m==='confirm'){
    h='<div><h1>Confirme seu e-mail</h1><p class="muted" style="margin-top:8px">Enviamos um link de confirmação para <b>'+esc(S.auth.f.email||'seu e-mail')+'</b>. Abra o e-mail, toque no link e depois entre no app.</p></div><p class="hint">Não chegou? Veja a caixa de spam. O link vale por tempo limitado.</p><button class="btn primary lg" data-act="authMode" data-v="login">Ir para o login</button>';
  }else{
    const allowU=cfg.allowUsernameLogin!==false;
    h='<div><h1>Entrar</h1><p class="muted" style="margin-top:8px">Acesse seus treinos e acompanhe sua evolução.</p></div>'+
      '<form id="authForm" novalidate>'+afield('id',allowU?'Usuário ou e-mail':'E-mail','text','username',' autocapitalize="none" autocorrect="off" spellcheck="false"')+pwfield('pw','Senha','current-password')+authMsgs()+submitBtn('Entrar','Entrando…')+'</form>'+
      '<div class="row between"><button class="linkbtn" data-act="authMode" data-v="forgot">Esqueci minha senha</button><button class="linkbtn" data-act="authMode" data-v="signup">Criar uma conta</button></div>';
  }
  return '<div class="center auth"><div class="card">'+brand()+h+'</div></div>';
}
function vSplash(){return '<div class="center"><div class="card" style="background:transparent;border:0">'+brand()+'<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div></div>'}
function vLoadError(){
  return '<div class="center"><div class="card">'+brand()+'<div><h1>Não foi possível carregar</h1><p class="muted" style="margin-top:8px">'+esc(S.errMsg||'Tente de novo em instantes.')+'</p></div><button class="btn primary lg" data-act="retry">Tentar de novo</button><button class="btn" data-act="signOutNow">Sair da conta</button></div></div>';
}

/* ============ perfil ============ */
function installCard(){
  if(isStandalone())return '<section class="card"><h3>App instalado</h3><p class="muted">Você está usando o CDS Fitness como app instalado.</p></section>';
  if(S.installEvt)return '<section class="card"><h3>Instalar no aparelho</h3><p class="muted">Abre em tela cheia, com ícone na tela inicial, e carrega mais rápido.</p><div class="row"><button class="btn primary" data-act="install">'+ic('dl','sm')+' Instalar app</button></div></section>';
  if(isIOS())return '<section class="card"><h3>Instalar no iPhone ou iPad</h3><ol class="steps"><li>Abra esta página no <b>Safari</b>.</li><li>Toque em <b>Compartilhar</b>.</li><li>Escolha <b>Adicionar à Tela de Início</b>.</li></ol></section>';
  return '<section class="card"><h3>Instalar no aparelho</h3><p class="muted">No Chrome do Android, abra o menu (três pontos) e toque em <b>Instalar app</b>. No computador, use o ícone de instalar na barra de endereço.</p></section>';
}
function vProfile(){
  if(!S.draft||!S.draft.p)S.draft={p:profileDraft(),pw:{a:'',b:''}};
  const p=S.draft.p,pw=S.draft.pw||(S.draft.pw={a:'',b:''}),light=document.documentElement.getAttribute('data-theme')==='light';
  const err=S.ui.pErr,perr=S.ui.pwErr,notifOk=('Notification' in window);
  return '<div class="stack"><div class="pagehead"><h1>Perfil</h1></div>'+
   '<section class="card"><h3>Seus dados</h3><div class="formgrid"><div class="field"><label for="pfName">Nome completo</label><input id="pfName" class="in" data-scope="pf" data-f="name" value="'+esc(p.name)+'"></div><div class="field"><label for="pfUser">Nome de usuário</label><input id="pfUser" class="in" autocapitalize="none" data-scope="pf" data-f="username" value="'+esc(p.username)+'"></div></div>'+
   '<div class="formgrid"><div class="field"><label for="pfGoal">Objetivo principal</label><select id="pfGoal" class="in" data-chg="pfSel" data-f="goal">'+opts(GOALS,p.goal||'','Selecione')+'</select></div><div class="field"><label for="pfStart">Início dos treinos</label><input id="pfStart" type="date" class="in" data-scope="pf" data-f="startDate" value="'+esc(p.startDate||'')+'"></div></div>'+
   '<div class="formgrid"><div class="field"><label for="pfWeek">Meta semanal (treinos)</label><input id="pfWeek" class="in" inputmode="numeric" data-scope="pf" data-f="weekGoal" value="'+esc(p.weekGoal)+'"></div><div class="field"><label for="pfRest">Descanso padrão (segundos)</label><input id="pfRest" class="in" inputmode="numeric" data-scope="pf" data-f="rest" value="'+esc(p.rest)+'"></div><div class="field"><label for="pfUnit">Unidade de carga</label><select id="pfUnit" class="in" data-chg="pfSel" data-f="unit">'+opts([['kg','Quilos (kg)'],['lb','Libras (lb)']],p.unit)+'</select></div></div>'+
   '<p class="hint">Trocar a unidade só muda o rótulo. Os números já registrados não são convertidos.</p>'+
   (notifOk?'<label class="switch" for="pfNotif"><input id="pfNotif" type="checkbox" data-chg="pfNotif"'+(p.notifications?' checked':'')+'><span>Avisar quando o descanso terminar<br><span class="hint">Funciona com o app aberto ou em segundo plano.</span></span></label>':'')+
   (err?'<p class="err" role="alert">'+esc(err)+'</p>':'')+'<div class="row"><button class="btn primary" data-act="savePf">Salvar alterações</button></div></section>'+
   '<section class="card"><h3>Conta</h3><div class="field"><span class="lab">E-mail de acesso</span><span class="t" style="overflow-wrap:anywhere">'+esc(S.email||'')+'</span></div>'+
   '<hr class="sep"><h3 style="font-size:18px">Alterar senha</h3><div class="formgrid"><div class="field"><label for="pwA">Nova senha</label><input id="pwA" class="in" type="password" autocomplete="new-password" data-scope="pw" data-f="a" value="'+esc(pw.a)+'"></div><div class="field"><label for="pwB">Confirmar nova senha</label><input id="pwB" class="in" type="password" autocomplete="new-password" data-scope="pw" data-f="b" value="'+esc(pw.b)+'"></div></div><p class="hint">Mínimo de 8 caracteres, com letras e números.</p>'+
   (perr?'<p class="err" role="alert">'+esc(perr)+'</p>':'')+'<div class="row"><button class="btn" data-act="changePw">Alterar senha</button></div>'+
   '<hr class="sep"><div class="row"><button class="btn" data-act="theme">'+ic('sun','sm')+' Tema '+(light?'escuro':'claro')+'</button>'+
   (S.ui.confirmOut?'':'<button class="btn danger" data-act="askSignOut">Sair da conta</button>')+'</div>'+
   (S.ui.confirmOut?'<div class="confirm"><b>Sair da conta?</b><span class="small">'+(S.ui.outWarn?'Há um treino em andamento que ainda não sincronizou com a internet. Se sair agora, ele continua guardado neste aparelho e volta quando você entrar de novo com a mesma conta.':'Você precisará entrar de novo para ver seus treinos.')+'</span><div class="row"><button class="btn danger fill" data-act="signOut">Sair</button><button class="btn" data-act="cancelSignOut">Cancelar</button></div></div>':'')+'</section>'+
   installCard()+
   '<section class="card"><h3>Apagar histórico</h3><p class="muted small">Remove todas as sessões registradas e os gráficos que dependem delas. Seus treinos e exercícios continuam. Não dá para desfazer.</p>'+
   (S.ui.wipe?'<div class="confirm"><b>Apagar '+S.sessions.length+' sessões?</b><div class="row"><button class="btn danger fill" data-act="wipe">Apagar tudo</button><button class="btn" data-act="cancelWipe">Cancelar</button></div></div>':'<div class="row"><button class="btn danger" data-act="askWipe">'+ic('trash','sm')+' Apagar todo o histórico</button></div>')+'</section></div>';
}
function profileDraft(){const p=S.profile||{};return {name:p.name||'',username:p.username||'',goal:p.goal||'',startDate:p.startDate||'',weekGoal:p.weekGoal||4,rest:p.rest||90,unit:p.unit||'kg',notifications:!!p.notifications}}

/* ============ casca e roteamento ============ */
function resumeBar(){
  if(!S.session||S.view==='session'||S.view==='home')return '';
  return '<div class="rest" style="margin:0"><div><div class="eyebrow">Treino em andamento</div><b style="font-size:22px">'+esc(S.session.workoutName)+'</b></div><button class="btn primary sm" data-act="resume">Continuar</button></div>';
}
function netBanner(){
  if(S.offlineData)return '<div class="banner warn" role="status">Sem conexão: mostrando os dados guardados no aparelho. O treino em andamento continua salvo aqui e sincroniza quando a internet voltar.</div>';
  if(!S.online)return '<div class="banner warn" role="status">Sem conexão. O treino em andamento fica salvo no aparelho e sincroniza quando a internet voltar. Outras alterações precisam de internet.</div>';
  return '';
}
function shell(content){
  const nav=[['home','Início','home'],['workouts','Treinos','dumb'],['history','Histórico','chart'],['profile','Perfil','user']];
  const b=n=>'<button class="'+(S.tab===n[0]?'on':'')+'" data-act="tab" data-v="'+n[0]+'"'+(S.tab===n[0]?' aria-current="page"':'')+'>'+ic(n[2])+'<span>'+n[1]+'</span></button>';
  return '<div class="shell'+(S.view==='session'?' focus':'')+'"><aside class="side"><div class="brand"><span class="logo">CDS</span>Fitness</div>'+nav.map(b).join('')+'</aside><main><div class="mobilebrand"><div class="brand" style="margin:0"><span class="logo">CDS</span>Fitness</div></div>'+netBanner()+resumeBar()+content+'</main><nav class="bottom" aria-label="Navegação principal">'+nav.map(b).join('')+'</nav></div>';
}
function bodyHtml(){
  if(S.boot==='loading')return vSplash();
  if(S.boot==='auth')return vAuth();
  if(S.boot==='error'||!S.profile)return vLoadError();
  const v=S.view;
  const c=v==='workouts'?vWorkouts():v==='history'?vHistory():v==='profile'?vProfile():v==='session'&&S.session?vSession():v==='wform'&&S.draft&&S.draft.w?vWForm():v==='eform'&&S.draft&&S.draft.e?vEForm():v==='sdetail'?vSessionDetail():vHome();
  return shell(c);
}
function render(){
  const y=window.scrollY||0;
  $('#app').innerHTML=bodyHtml();
  S.rendered=true;
  if(S.top){window.scrollTo(0,0);S.top=false}else window.scrollTo(0,y);
}
function softRender(){
  if(S.boot!=='ready'||!S.profile)return;
  if(LOCK.includes(S.view))return;
  render();
}
function go(view,o){o=o||{};S.view=view;if(o.tab)S.tab=o.tab;S.top=true;render()}
