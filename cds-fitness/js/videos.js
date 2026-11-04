'use strict';
/* ============ vídeos demonstrativos dos exercícios ============
   - Um vídeo por exercício (tabela exercise_videos), vale em todos os treinos que usam o exercício.
   - Fontes: link do YouTube/Vimeo, link direto de arquivo (.mp4/.webm/.mov) ou arquivo enviado ao Storage.
   - Carregamento sob demanda: nada de vídeo é baixado até a pessoa tocar em "Ver demonstração".
   - O player vive dentro do cartão do exercício e SOBREVIVE aos redesenhos da tela
     (marcar série, adicionar série...), então o vídeo não reinicia enquanto se registra o treino. */
const VID_BUCKET='exercise-videos',VID_MAX=50*1024*1024,VID_TYPES={mp4:'video/mp4',webm:'video/webm',mov:'video/quicktime'};
const VID_FILE_RE=/\.(mp4|webm|mov|m4v|ogv)$/i;
const VURL={}; /* cache de endereços assinados dos arquivos: caminho -> {p:Promise, exp} */

/* ---------- interpretação do link ---------- */
function parseVideoUrl(raw){
  let s=String(raw==null?'':raw).trim();
  if(!s)return {err:'Cole o link do vídeo.'};
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s)){if(/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s))s='https://'+s;else return {err:'O link precisa começar com https://'}}
  let u;try{u=new URL(s)}catch(e){return {err:'Esse link não parece válido.'}}
  if(u.protocol!=='https:')return {err:'Use um link que comece com https:// (links http não são aceitos).'}
  if(u.username||u.password)return {err:'O link não pode conter usuário e senha.'}
  if(u.href.length>2000)return {err:'O link é longo demais.'}
  const h=u.hostname.toLowerCase().replace(/^(www|m)\./,'');
  if(h==='youtu.be'||h==='youtube.com'||h==='youtube-nocookie.com'||h==='music.youtube.com'){
    let id=null;
    if(h==='youtu.be')id=u.pathname.slice(1).split('/')[0];
    else if(u.pathname==='/watch')id=u.searchParams.get('v');
    else{const m=u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})(?:\/|$)/);if(m)id=m[1]}
    if(id&&/^[\w-]{11}$/.test(id))return {type:'youtube',id:id,href:u.href};
    return {err:'Não encontrei o vídeo nesse link do YouTube. Copie o endereço da página do vídeo.'};
  }
  if(h==='vimeo.com'||h==='player.vimeo.com'){
    const m=u.pathname.match(/(?:^|\/)(\d{6,})(?:\/([0-9a-f]{6,}))?\/?$/i);
    if(m)return {type:'vimeo',id:m[1],hash:(u.searchParams.get('h')||m[2]||'').replace(/[^0-9a-f]/gi,''),href:u.href};
    return {err:'Não encontrei o vídeo nesse link do Vimeo.'};
  }
  if(VID_FILE_RE.test(u.pathname))return {type:'file',url:u.href,href:u.href};
  return {err:'Link não reconhecido. Use YouTube, Vimeo ou um link direto para um arquivo de vídeo (.mp4, .webm ou .mov).'};
}
/* fonte de reprodução de um vídeo cadastrado */
function vidSource(v){
  if(v.kind==='arquivo')return {type:'storage',path:v.path};
  const p=parseVideoUrl(v.url);
  return p.err?{type:'invalid',err:p.err}:p;
}
const vidIsEmbed=v=>{const s=vidSource(v);return s.type==='youtube'||s.type==='vimeo'};
function vidLabel(v){
  if(v.kind==='arquivo')return 'Arquivo enviado'+(v.fileName?': '+v.fileName:'');
  const s=vidSource(v);
  return s.type==='youtube'?'Link do YouTube':s.type==='vimeo'?'Link do Vimeo':s.type==='file'?'Link direto de vídeo':'Link';
}

/* ---------- endereço assinado dos arquivos (bucket privado) ---------- */
function vidSigned(path,fresh){
  const c=VURL[path];
  if(!fresh&&c&&c.exp>Date.now())return c.p;
  const p=api.videoUrl(path);
  VURL[path]={p:p,exp:Date.now()+3.5*3600*1000};
  p.catch(()=>{if(VURL[path]&&VURL[path].p===p)delete VURL[path]});
  return p;
}

/* ---------- HTML do campo de vídeo ---------- */
function vidSlot(exId,name,ctx){
  if(!S.videosReady||!exId)return '';
  const v=S.videos[exId],key=ctx==='sheet'?'sheet:'+exId:exId,k=esc(key),x=esc(exId),nm=esc(name||'exercício');
  if(!v){
    if(ctx==='sheet')return '';
    return '<aside class="vslot none" data-vslot="'+k+'" aria-label="Vídeo demonstrativo de '+nm+'"><span class="vtxt">Sem vídeo demonstrativo</span><button class="btn sm ghost" data-act="vidEdit" data-vx="'+x+'">'+ic('plus','sm')+' Adicionar vídeo</button></aside>';
  }
  const edit=ctx==='sheet'?'':'<button class="btn sm icon ghost" aria-label="Editar vídeo de '+nm+'" data-act="vidEdit" data-vx="'+x+'">'+ic('edit','sm')+'</button>';
  if(S.ui.vOpen!==key)
    return '<aside class="vslot" data-vslot="'+k+'" aria-label="Vídeo demonstrativo de '+nm+'"><button class="vposter" data-act="vidPlay" data-k="'+k+'" data-vx="'+x+'" aria-label="Ver demonstração de '+nm+'"><span class="vplay">'+ic('play')+'</span><span>Ver demonstração</span></button>'+edit+'</aside>';
  const emb=vidIsEmbed(v);
  return '<aside class="vslot open" data-vslot="'+k+'" aria-label="Vídeo demonstrativo de '+nm+'"><div class="vpl" data-vkey="'+k+'" data-vx="'+x+'"></div>'+
   '<div class="row vctl">'+(emb?'':'<button class="btn sm" data-act="vidSeek" data-k="'+k+'" data-s="-10" aria-label="Voltar 10 segundos">−10 s</button><button class="btn sm" data-act="vidSeek" data-k="'+k+'" data-s="10" aria-label="Avançar 10 segundos">+10 s</button>')+
   '<button class="btn sm" data-act="vidFull" data-k="'+k+'">'+ic('full','sm')+' Tela cheia</button><button class="btn sm ghost" data-act="vidClose">Fechar vídeo</button>'+edit+'</div></aside>';
}

/* ---------- montagem do player (só quando o vídeo é aberto) ---------- */
function vidMsg(el,text,retryKey){
  el.textContent='';
  const d=document.createElement('div');d.className='vload';d.setAttribute('role','status');d.textContent=text;
  if(retryKey){const b=document.createElement('button');b.className='btn sm';b.type='button';b.textContent='Tentar de novo';b.dataset.act='vidRetry';b.dataset.k=retryKey;d.appendChild(b)}
  el.appendChild(d);
}
async function vidFill(el){
  const key=el.dataset.vkey,exId=el.dataset.vx,v=S.videos[exId];
  if(!v){el.textContent='';return}
  const src=vidSource(v),auto=S.ui.vAuto===key;
  if(auto)S.ui.vAuto=null;
  if(src.type==='invalid'){vidMsg(el,src.err);return}
  if(src.type==='youtube'||src.type==='vimeo'){
    const f=document.createElement('iframe');
    f.src=src.type==='youtube'
      ?'https://www.youtube-nocookie.com/embed/'+src.id+'?rel=0&playsinline=1&modestbranding=1'+(auto?'&autoplay=1':'')
      :'https://player.vimeo.com/video/'+src.id+'?dnt=1&playsinline=1'+(src.hash?'&h='+src.hash:'')+(auto?'&autoplay=1':'');
    f.title='Vídeo demonstrativo';
    f.allow='fullscreen; picture-in-picture; encrypted-media; autoplay';
    f.allowFullscreen=true;
    f.referrerPolicy='strict-origin-when-cross-origin'; /* o YouTube recusa o player sem referência */
    f.setAttribute('loading','lazy');
    el.appendChild(f);return;
  }
  let url=src.url;
  if(src.type==='storage'){
    vidMsg(el,'Carregando vídeo…');
    try{url=await vidSigned(src.path)}catch(e){if(el.isConnected)vidMsg(el,isNetErr(e)?'Sem conexão para carregar o vídeo.':'Não foi possível carregar o vídeo.',key);return}
    if(!el.isConnected||S.ui.vOpen!==key)return;
    el.textContent='';
  }
  const m=document.createElement('video');
  m.controls=true;m.playsInline=true;m.preload='metadata';m.setAttribute('controlsList','nodownload');m.setAttribute('aria-label','Vídeo demonstrativo');
  let retried=false;
  m.addEventListener('error',async()=>{
    if(src.type==='storage'&&!retried){retried=true;try{m.src=await vidSigned(src.path,true);return}catch(e){}}
    if(m.isConnected)vidMsg(m.parentNode,'Não foi possível reproduzir este vídeo. Confira o link ou o formato do arquivo.',key);
  });
  m.src=url;
  el.appendChild(m);
  if(auto){const p=m.play();if(p&&p.catch)p.catch(()=>{})}
}
function vidMount(root){
  root.querySelectorAll('.vpl[data-vkey]').forEach(el=>{if(!el.firstChild&&S.ui.vOpen===el.dataset.vkey)vidFill(el)});
}
function vidRelease(el){
  el.querySelectorAll('video').forEach(m=>{try{m.pause();m.removeAttribute('src');m.load()}catch(e){}});
  el.querySelectorAll('iframe').forEach(f=>{f.src='about:blank'});
}

/* Redesenha a tela sem destruir o player aberto: o elemento do vídeo é MOVIDO para o novo desenho
   (moveBefore preserva reprodução e iframes). Em navegadores sem moveBefore o <video> volta ao
   ponto em que estava; o player do YouTube/Vimeo recarrega. */
function vidRender(app,html){
  const live=[...app.querySelectorAll('.vpl[data-vkey]')].filter(e=>e.firstChild&&e.dataset.vkey===S.ui.vOpen&&e.querySelector('video,iframe'));
  if(!live.length){
    app.querySelectorAll('.vpl[data-vkey]').forEach(vidRelease);
    app.innerHTML=html;vidMount(app);return;
  }
  const st=document.createElement('div');
  st.style.display='none';st.innerHTML=html;
  app.parentNode.insertBefore(st,app);
  const canMove=typeof app.moveBefore==='function',saved=new Map();
  const kept=new Set();
  live.forEach(el=>{
    const slot=[...st.querySelectorAll('.vpl[data-vkey]')].find(n=>n.dataset.vkey===el.dataset.vkey);
    if(!slot)return;
    const vid=el.querySelector('video');
    if(vid)saved.set(el,{t:vid.currentTime,paused:vid.paused});
    try{
      if(canMove)slot.parentNode.moveBefore(el,slot);else slot.parentNode.insertBefore(el,slot);
      slot.remove();kept.add(el);
    }catch(e){try{slot.parentNode.insertBefore(el,slot);slot.remove();kept.add(el)}catch(e2){}}
  });
  app.querySelectorAll('.vpl[data-vkey]').forEach(el=>{if(!kept.has(el))vidRelease(el)});
  const kids=[...st.childNodes];
  app.replaceChildren();
  kids.forEach(c=>{
    if(canMove){try{app.moveBefore(c,null);return}catch(e){}}
    app.appendChild(c);
  });
  st.remove();
  if(!canMove)kept.forEach(el=>{
    const s=saved.get(el),m=el.querySelector('video');
    if(s&&m){const go=()=>{try{m.currentTime=s.t}catch(e){}if(!s.paused){const p=m.play();if(p&&p.catch)p.catch(()=>{})}};
      if(m.readyState>=1)go();else m.addEventListener('loadedmetadata',go,{once:true})}
  });
  vidMount(app);
}

/* ---------- janela de cadastro: adicionar, trocar e remover ---------- */
function vidSheet(){
  const sh=S.ui.vSheet;if(!sh)return '';
  const v=S.videos[sh.id],nm=esc(sh.name);
  const cur=v?'<div class="vcur"><div class="eyebrow">Vídeo atual</div><span class="small">'+esc(vidLabel(v))+'</span>'+(v.kind==='link'?'<span class="small muted vurl">'+esc(v.url)+'</span>':'')+'</div>'+vidSlot(sh.id,sh.name,'sheet'):'';
  const mode=sh.mode;
  const body=mode==='file'
   ?'<div class="field"><label for="vdFile">Arquivo de vídeo</label><input id="vdFile" class="in" type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" data-chg="vidFile"><p class="hint">'+(sh.file?'Selecionado: <b>'+esc(sh.file.name)+'</b> ('+fmt(sh.file.size/1048576,1)+' MB)':'MP4, WebM ou MOV, até 50 MB. Prefira o Wi-Fi para enviar.')+'</p></div>'
   :'<div class="field"><label for="vdUrl">Link do vídeo</label><input id="vdUrl" class="in" type="url" inputmode="url" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="https://www.youtube.com/watch?v=..." data-scope="vid" data-f="url" value="'+esc(sh.url)+'"><p class="hint">YouTube, Vimeo ou link direto para um arquivo .mp4, .webm ou .mov. O vídeo toca aqui dentro do app.</p></div>';
  const del=sh.confirm?'<div class="confirm"><b>Remover o vídeo de "'+nm+'"?</b><span class="small">O exercício, os treinos e o histórico continuam como estão. Só o vídeo é removido.</span><div class="row"><button class="btn danger fill sm" data-act="vidRemove"'+(sh.busy?' disabled':'')+'>Remover vídeo</button><button class="btn sm" data-act="vidCancelRemove">Cancelar</button></div></div>':'';
  return '<div class="sheet-back" data-act="vidSheetBg"><div class="sheet" role="dialog" aria-modal="true" aria-label="Vídeo demonstrativo de '+nm+'"><div class="row between"><h3>Vídeo demonstrativo</h3><button class="btn sm" data-act="vidSheetClose">Fechar</button></div>'+
   '<div class="scroll vsheet"><p class="muted small">Exercício: <b>'+nm+'</b>. O vídeo vale para este exercício em todos os treinos, inclusive nos antigos.</p>'+cur+
   '<div class="eyebrow">'+(v?'Substituir por':'Adicionar')+'</div>'+
   '<div class="seg" role="group" aria-label="Origem do vídeo"><button class="'+(mode==='link'?'on':'')+'" aria-pressed="'+(mode==='link')+'" data-act="vidMode" data-v="link">Link</button><button class="'+(mode==='file'?'on':'')+'" aria-pressed="'+(mode==='file')+'" data-act="vidMode" data-v="file">Arquivo</button></div>'+
   body+(sh.err?'<p class="err" role="alert">'+esc(sh.err)+'</p>':'')+
   '<div class="row"><button class="btn primary" data-act="vidSave"'+(sh.busy?' disabled':'')+'>'+(sh.busy?(mode==='file'?'Enviando…':'Salvando…'):(v?'Substituir vídeo':'Salvar vídeo'))+'</button>'+(v&&!sh.confirm?'<button class="btn danger ghost" data-act="vidAskRemove"'+(sh.busy?' disabled':'')+'>Remover vídeo</button>':'')+'</div>'+del+'</div></div></div>';
}
function vidOpenSheet(exId){
  const ex=exById(exId),v=S.videos[exId];
  S.ui.vSheet={id:exId,name:ex?ex.name:'Exercício',mode:v&&v.kind==='arquivo'?'file':'link',url:v&&v.kind==='link'?v.url:'',file:null,err:'',busy:false,confirm:false};
  render();
}
function vidCloseSheet(){
  const sh=S.ui.vSheet;if(sh&&sh.busy)return;
  if(S.ui.vOpen&&S.ui.vOpen.indexOf('sheet:')===0)S.ui.vOpen=null;
  S.ui.vSheet=null;render();
}
async function vidSave(){
  const sh=S.ui.vSheet;if(!sh||sh.busy)return;
  if(!S.videosReady){sh.err='Falta atualizar o banco de dados (rode o supabase/schema.sql no Supabase).';render();return}
  const old=S.videos[sh.id];let row,newPath=null;
  if(sh.mode==='link'){
    const p=parseVideoUrl(sh.url);
    if(p.err){sh.err=p.err;render();return}
    row={kind:'link',url:p.href,storage_path:null,file_name:null};
  }else{
    const f=sh.file;
    if(!f){sh.err='Escolha um arquivo de vídeo.';render();return}
    const ext=(f.name.split('.').pop()||'').toLowerCase();
    newPath=S.uid+'/'+sh.id+'/'+Date.now()+'.'+ext;
    row={kind:'arquivo',url:null,storage_path:newPath,file_name:f.name.slice(0,200)};
  }
  sh.busy=true;sh.err='';render();
  try{
    if(newPath){
      const ext=newPath.split('.').pop();
      await api.uploadVideo(newPath,sh.file,VID_TYPES[ext]);
    }
    try{await api.saveVideo(sh.id,row)}
    catch(e){if(newPath)api.removeVideoFile(newPath);throw e}
  }catch(e){
    sh.busy=false;sh.err=/exceeded|too large|payload/i.test(String(e&&e.message))?'O arquivo passou do limite de tamanho do servidor.':errMsg(e);render();return;
  }
  if(old&&old.kind==='arquivo'&&old.path&&old.path!==newPath)api.removeVideoFile(old.path);
  S.videos[sh.id]={id:(old&&old.id)||'',exerciseId:sh.id,kind:row.kind,url:row.url||'',path:row.storage_path||'',fileName:row.file_name||''};
  cacheNow();
  const wasSheetKey='sheet:'+sh.id;
  if(S.ui.vOpen===sh.id||S.ui.vOpen===wasSheetKey)S.ui.vOpen=null;
  S.ui.vSheet=null;render();toast(old?'Vídeo substituído.':'Vídeo adicionado.');
}
async function vidRemove(){
  const sh=S.ui.vSheet,v=sh&&S.videos[sh.id];if(!sh||!v||sh.busy)return;
  sh.busy=true;render();
  try{await api.deleteVideo(sh.id)}catch(e){sh.busy=false;sh.confirm=false;sh.err=errMsg(e);render();return}
  if(v.kind==='arquivo'&&v.path){api.removeVideoFile(v.path);delete VURL[v.path]}
  delete S.videos[sh.id];cacheNow();
  if(S.ui.vOpen===sh.id||S.ui.vOpen==='sheet:'+sh.id)S.ui.vOpen=null;
  S.ui.vSheet=null;render();toast('Vídeo removido.');
}
function vidEl(key,sel){const b=[...document.querySelectorAll('.vpl[data-vkey]')].find(e=>e.dataset.vkey===key);return b?b.querySelector(sel||'video,iframe'):null}

const A_VID={
 vidPlay(d){S.ui.vOpen=d.k;S.ui.vAuto=d.k;render()},
 vidClose(){S.ui.vOpen=null;render()},
 vidEdit(d){vidOpenSheet(d.vx)},
 vidSeek(d){const m=vidEl(d.k,'video');if(!m)return;const t=m.currentTime+(+d.s||0);m.currentTime=Math.max(0,isFinite(m.duration)?Math.min(m.duration,t):t)},
 vidFull(d){
  const m=vidEl(d.k);if(!m){toast('Abra o vídeo primeiro.');return}
  try{
    if(m.requestFullscreen)m.requestFullscreen();
    else if(m.webkitEnterFullscreen)m.webkitEnterFullscreen();
    else if(m.webkitRequestFullscreen)m.webkitRequestFullscreen();
    else toast('Tela cheia indisponível neste aparelho. Use o botão do próprio player.');
  }catch(e){toast('Não foi possível abrir em tela cheia.','bad')}
 },
 vidRetry(d){const b=[...document.querySelectorAll('.vpl[data-vkey]')].find(e=>e.dataset.vkey===d.k);if(b){b.textContent='';vidFill(b)}},
 vidSheetClose(){vidCloseSheet()},
 vidSheetBg(d,el,ev){if(ev.target===el)vidCloseSheet()},
 vidMode(d){const sh=S.ui.vSheet;if(!sh||sh.busy)return;sh.mode=d.v;sh.err='';render()},
 vidSave(){once('vsave',vidSave)},
 vidAskRemove(){const sh=S.ui.vSheet;if(sh){sh.confirm=true;sh.err='';render()}},
 vidCancelRemove(){const sh=S.ui.vSheet;if(sh){sh.confirm=false;render()}},
 vidRemove(){once('vrem',vidRemove)}
};
const C_VID={
 vidFile(t){
  const sh=S.ui.vSheet,f=t.files&&t.files[0];if(!sh||!f)return;
  const ext=(f.name.split('.').pop()||'').toLowerCase();
  sh.file=null;
  if(!VID_TYPES[ext])sh.err='Formato não aceito. Use um arquivo .mp4, .webm ou .mov.';
  else if(f.size>VID_MAX)sh.err='O arquivo tem '+fmt(f.size/1048576,1)+' MB. O limite é 50 MB: comprima o vídeo ou use um link.';
  else if(f.size<=0)sh.err='O arquivo está vazio.';
  else{sh.file=f;sh.err=''}
  render();
 }
};
