'use strict';
/* ============ utilidades ============ */
const $=(s,r=document)=>r.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:0};
const fmt=(n,d=1)=>(Math.round(n*Math.pow(10,d))/Math.pow(10,d)).toLocaleString('pt-BR',{maximumFractionDigits:d});
const clone=o=>JSON.parse(JSON.stringify(o));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const ymd=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const todayStr=()=>ymd(new Date());
const parseYmd=s=>{const p=String(s).split('-').map(Number);return new Date(p[0],p[1]-1,p[2])};
const fmtDate=s=>parseYmd(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'});
const fmtShort=s=>parseYmd(s).toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
const weekStart=d=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()-((x.getDay()+6)%7));return x};
const addDays=(d,n)=>{const x=new Date(d.getFullYear(),d.getMonth(),d.getDate());x.setDate(x.getDate()+n);return x};
const clock=sec=>{sec=Math.max(0,Math.round(sec));const h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;return (h?h+':'+String(m).padStart(2,'0'):m)+':'+String(s).padStart(2,'0')};
const dur=sec=>{const m=Math.round(sec/60);return m<60?m+' min':Math.floor(m/60)+' h '+String(m%60).padStart(2,'0')+' min'};
const DAYS=['Domingo','Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado'];
const DAYS_S=['D','S','T','Q','Q','S','S'];
const slug=s=>s.normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const ago=s=>{const n=Math.round((parseYmd(todayStr())-parseYmd(s))/864e5);return n===0?'hoje':n===1?'ontem':'há '+n+' dias'};

const IC={
 home:'<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>',
 dumb:'<path d="M6 7v10M3 10v4M18 7v10M21 10v4M6 12h12"/>',
 chart:'<path d="M4 4v16h16M8 15l4-5 3 3 5-7"/>',
 user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',minus:'<path d="M5 12h14"/>',
 check:'<path d="M5 12.5l4.5 4.5L19 7.5"/>',
 trash:'<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
 edit:'<path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4"/>',
 copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
 up:'<path d="M6 15l6-6 6 6"/>',down:'<path d="M6 9l6 6 6-6"/>',
 play:'<path d="M7 5l12 7-12 7z"/>',x:'<path d="M6 6l12 12M18 6L6 18"/>',
 back:'<path d="M15 5l-7 7 7 7"/>',sun:'<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5"/>',
 dl:'<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
 cycle:'<path d="M20 12a8 8 0 1 1-2.5-5.8M20 4v4.5h-4.5"/>'
};
const ic=(n,c)=>'<svg class="ic '+(c||'')+'" viewBox="0 0 24 24" aria-hidden="true">'+IC[n]+'</svg>';

const uuid=()=>{try{if(crypto.randomUUID)return crypto.randomUUID()}catch(e){}return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0;return (c==='x'?r:(r&3|8)).toString(16)})};
const downloadFile=(name,text,type)=>{const b=new Blob([text],{type:type||'text/csv;charset=utf-8'}),u=URL.createObjectURL(b),a=document.createElement('a');a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000)};
const isStandalone=()=>{try{return matchMedia('(display-mode: standalone)').matches||navigator.standalone===true}catch(e){return false}};
const isIOS=()=>/iphone|ipad|ipod/i.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);

/* ============ constantes ============ */
const GROUPS=['Peito','Costas','Ombros','Bíceps','Tríceps','Antebraço','Abdômen','Quadríceps','Posterior de coxa','Glúteos','Panturrilha','Corpo inteiro'];
const EQUIP=['Barra','Halteres','Máquinas','Polias','Peso corporal','Elásticos','Outros'];
const GOALS=['Hipertrofia','Força','Emagrecimento','Condicionamento','Saúde geral'];

/* ============ estado ============ */
const S={boot:'loading',uid:null,email:'',profile:null,stdEx:[],exercises:[],workouts:[],sessions:[],cycles:[],extras:[],cyclesReady:true,closing:{},
 tab:'home',view:'home',seg:{workouts:'treinos',history:'sessoes'},session:null,rest:null,sync:'saved',draft:null,sel:null,
 ui:{},discarded:{},auth:{mode:'login',f:{},err:'',info:'',busy:false},online:navigator.onLine!==false,offlineData:false,installEvt:null,rendered:false,top:false,errMsg:''};
const LOCK=['session','wform','eform','profile','cform','gform'];
const unit=()=>(S.profile&&S.profile.unit)||'kg';
const restDefault=()=>(S.profile&&S.profile.rest)||90;
const allEx=()=>S.stdEx.concat(S.exercises.filter(e=>!e.archived));
const exById=id=>S.stdEx.find(e=>e.id===id)||S.exercises.find(e=>e.id===id);
const stdBySlug=sl=>S.stdEx.find(e=>e.slug===sl);
const SYNC_TXT={saved:'Salvo',saving:'Salvando…',error:'Salvo no aparelho, sem sincronizar'};

/* ============ feedback ============ */
let toastTimer;
function toast(m,kind){const el=$('#toast');el.textContent=m;el.className='toast show '+(kind||'');clearTimeout(toastTimer);toastTimer=setTimeout(()=>{el.className='toast'},3600)}
function setSync(v){S.sync=v;const el=$('#sync');if(el){el.className='sync '+v;el.textContent=SYNC_TXT[v]}}
const isNetErr=e=>!navigator.onLine||/failed to fetch|networkerror|load failed|network request failed|fetch/i.test(String((e&&e.message)||e||''));
function errMsg(e){
  const m=String((e&&e.message)||''),c=e&&e.code;
  if(isNetErr(e))return 'Sem conexão. Verifique a internet e tente de novo.';
  if(c==='23505')return 'Já existe um registro com esse nome.';
  if(c==='42501'||/row-level security/i.test(m))return 'Sem permissão para essa operação. Saia e entre de novo na sua conta.';
  if(c==='P0001')return m;
  if(c==='PGRST301'||/jwt/i.test(m))return 'Sua sessão expirou. Entre de novo.';
  if(c==='23503')return 'Esse item depende de outro que não existe mais. Atualize a tela e tente de novo.';
  return 'Não foi possível salvar. Tente de novo.';
}

/* ============ cálculos ============ */
const setsDone=ex=>(ex.sets||[]).filter(s=>s.done&&num(s.reps)>0);
const exVolume=ex=>setsDone(ex).reduce((a,s)=>a+num(s.load)*num(s.reps),0);
const sesVolume=ses=>(ses.exercises||[]).reduce((a,e)=>a+exVolume(e),0);
const finished=()=>S.sessions.filter(s=>s.status==='concluida');
function histFor(exId){
  const out=[];
  finished().forEach(s=>{(s.exercises||[]).forEach(e=>{
    if(e.exerciseId!==exId)return;const sets=setsDone(e);if(!sets.length)return;
    out.push({ts:s.startedAt||s.date,date:s.date,sid:s.id,workout:s.workoutName,name:e.name,sets:sets,
      maxLoad:Math.max.apply(null,sets.map(x=>num(x.load))),bestReps:Math.max.apply(null,sets.map(x=>num(x.reps))),
      totalReps:sets.reduce((a,x)=>a+num(x.reps),0),volume:exVolume(e)});
  })});
  return out.sort((a,b)=>String(a.ts).localeCompare(String(b.ts)));
}
function exercisesWithHistory(){
  const m=new Map();
  finished().forEach(s=>(s.exercises||[]).forEach(e=>{if(!setsDone(e).length)return;const c=m.get(e.exerciseId)||{id:e.exerciseId,name:e.name,group:e.group,n:0};c.n++;c.name=(exById(e.exerciseId)||{}).name||e.name;m.set(e.exerciseId,c)}));
  return Array.from(m.values()).sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
}
function personalRecords(){
  return exercisesWithHistory().map(x=>{
    const h=histFor(x.id);let best=null;
    h.forEach(e=>e.sets.forEach(s=>{const l=num(s.load),r=num(s.reps);if(!best||l>best.load||(l===best.load&&r>best.reps))best={load:l,reps:r,date:e.date}}));
    return {exId:x.id,name:x.name,load:best.load,reps:best.reps,date:best.date};
  }).sort((a,b)=>b.load-a.load||b.reps-a.reps);
}
function evolutionRank(entriesOf){
  return exercisesWithHistory().map(x=>{
    const h=(entriesOf?entriesOf(x.id):histFor(x.id));if(h.length<2)return null;
    const a=h[0].maxLoad,b=h[h.length-1].maxLoad;if(a<=0)return null;
    return {exId:x.id,name:x.name,from:a,to:b,pct:(b-a)/a*100};
  }).filter(Boolean).sort((a,b)=>b.pct-a.pct);
}
function suggest(exId,planned){
  const h=histFor(exId);if(!h.length)return null;
  const last=h[h.length-1],sets=last.sets,top=last.maxLoad;
  const planSets=planned.sets||3,max=planned.repMax||12,min=planned.repMin||8,inc=planned.inc==null?2.5:planned.inc,u=unit();
  const allMax=sets.length>=planSets&&sets.every(s=>num(s.reps)>=max);
  if(allMax)return {type:'up',current:top,suggested:Math.round((top+inc)*100)/100,
    reason:'Na última sessão ('+fmtDate(last.date)+') você fez '+max+' repetições ou mais em todas as '+sets.length+' séries. Dá para subir '+fmt(inc,2)+' '+u+' com segurança.'};
  if(sets.some(s=>num(s.reps)<min))return {type:'keep',current:top,suggested:top,
    reason:'Alguma série da última sessão ficou abaixo de '+min+' repetições. Mantenha a carga e reavalie o desempenho.'};
  return {type:'keep',current:top,suggested:top,reason:'Ainda não foram '+max+' repetições em todas as séries. Mantenha '+fmt(top,2)+' '+u+' até chegar lá.'};
}
function bucket(entries,mode){
  if(mode==='sessao')return entries.map(e=>({label:fmtShort(e.date),date:e.date,maxLoad:e.maxLoad,bestReps:e.bestReps,volume:e.volume,n:1}));
  const m=new Map();
  entries.forEach(e=>{const k=mode==='semana'?ymd(weekStart(parseYmd(e.date))):e.date.slice(0,7);
    const c=m.get(k)||{key:k,date:e.date,maxLoad:0,bestReps:0,volume:0,n:0};
    c.maxLoad=Math.max(c.maxLoad,e.maxLoad);c.bestReps=Math.max(c.bestReps,e.bestReps);c.volume+=e.volume;c.n++;m.set(k,c)});
  return Array.from(m.values()).map(c=>Object.assign(c,{label:mode==='semana'?'sem '+fmtShort(c.key):parseYmd(c.key+'-01').toLocaleDateString('pt-BR',{month:'short',year:'2-digit'}).replace('.','')}));
}
function inPeriod(date,p){
  if(!p||p.period==='all')return true;
  if(p.period==='custom')return (!p.from||date>=p.from)&&(!p.to||date<=p.to);
  return date>=ymd(addDays(new Date(),-Number(p.period)));
}
