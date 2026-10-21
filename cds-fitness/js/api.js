'use strict';
/* ============ camada de dados (Supabase) ============ */
const CFG=window.CDS_CONFIG||{};
let sb=null;
function configured(){
  const u=String(CFG.SUPABASE_URL||''),k=String(CFG.SUPABASE_ANON_KEY||'');
  return /^https?:\/\//.test(u)&&k.length>20&&!/SEU-PROJETO|COLE_A_CHAVE/i.test(u+k);
}
function connect(){
  sb=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  return sb;
}
function must(r){if(r.error)throw r.error;return r.data}
/* o PostgREST devolve no máximo 1000 linhas por pedido: busca em páginas */
async function fetchAll(make){
  const size=1000;let all=[];
  for(let from=0;;from+=size){
    const rows=must(await make(from,from+size-1));
    all=all.concat(rows);
    if(rows.length<size)break;
  }
  return all;
}

/* ---- conversões banco <-> app ---- */
const mapProfile=r=>({name:r.full_name,username:r.username,goal:r.goal||'',startDate:r.start_date||'',weekGoal:r.week_goal,unit:r.unit,rest:r.rest_seconds,theme:r.theme,notifications:!!r.notifications,schedule:r.schedule||{}});
const mapEx=r=>({id:r.id,slug:r.slug||'',name:r.name,group:r.muscle_group,equip:r.equipment,secondary:r.secondary_groups||[],desc:r.description||'',notes:r.notes||'',std:!r.user_id,archived:!!r.archived_at,createdAt:r.created_at});
function mapWorkouts(ws,wes,look){
  const by={};wes.forEach(e=>{(by[e.workout_id]=by[e.workout_id]||[]).push(e)});
  return ws.map(w=>({id:w.id,name:w.name,description:w.description||'',goal:w.goal||'',muscles:w.muscles||[],notes:w.notes||'',createdAt:w.created_at,updatedAt:w.updated_at,
    exercises:(by[w.id]||[]).sort((a,b)=>a.position-b.position).map(e=>{const x=look(e.exercise_id)||{};
      return {exerciseId:e.exercise_id,name:x.name||'Exercício removido',group:x.group||'',sets:e.sets,repMin:e.rep_min,repMax:e.rep_max,load:e.load==null?'':Number(e.load),rest:e.rest_seconds,inc:Number(e.progression_inc),notes:e.notes||''}})}));
}
function mapSessions(ss,ses,sets){
  const setsBy={};sets.forEach(s=>{(setsBy[s.session_exercise_id]=setsBy[s.session_exercise_id]||[]).push(s)});
  const exBy={};ses.forEach(e=>{(exBy[e.session_id]=exBy[e.session_id]||[]).push(e)});
  return ss.filter(s=>s.status==='concluida').map(s=>({id:s.id,workoutId:s.workout_id,workoutName:s.workout_name,date:s.session_date,startedAt:s.started_at,endedAt:s.ended_at,
    durationSec:s.duration_seconds||0,volume:Number(s.total_volume)||0,notes:s.notes||'',status:'concluida',
    exercises:(exBy[s.id]||[]).sort((a,b)=>a.position-b.position).map(e=>({exerciseId:e.exercise_id,name:e.exercise_name,group:e.muscle_group||'',
      planned:{sets:e.planned_sets,repMin:e.planned_rep_min,repMax:e.planned_rep_max,load:e.planned_load==null?'':Number(e.planned_load)},notes:e.notes||'',
      sets:(setsBy[e.id]||[]).sort((a,b)=>a.set_number-b.set_number).map(x=>({load:Number(x.load),reps:x.reps,done:true}))}))}))
    .sort((a,b)=>String(b.startedAt).localeCompare(String(a.startedAt)));
}
const mapCycle=r=>({id:r.id,name:r.name,workoutIds:Array.isArray(r.workout_ids)?r.workout_ids:[],rounds:r.rounds,totalSessions:r.total_sessions,startDate:r.start_date,deadline:r.deadline,
  daysPerWeek:r.days_per_week,autoClose:r.auto_close!==false,status:r.status,endDate:r.end_date||null,completion:r.completion||null,summary:r.summary||null,
  workouts:Array.isArray(r.workouts_snapshot)?r.workouts_snapshot:[],handled:!!r.handled,renewOf:r.renew_of||null,createdAt:r.created_at});
const mapExtra=r=>({id:r.id,type:r.activity_type,date:r.activity_date,durationMin:r.duration_min,notes:r.notes||'',createdAt:r.created_at});
function cycleRow(c){
  const m={name:'name',workoutIds:'workout_ids',rounds:'rounds',totalSessions:'total_sessions',startDate:'start_date',deadline:'deadline',daysPerWeek:'days_per_week',autoClose:'auto_close',
    status:'status',endDate:'end_date',completion:'completion',summary:'summary',workouts:'workouts_snapshot',handled:'handled',renewOf:'renew_of'},o={};
  Object.keys(c).forEach(k=>{if(m[k])o[m[k]]=c[k]});
  return o;
}
function profilePatch(p){
  const m={name:'full_name',username:'username',goal:'goal',startDate:'start_date',weekGoal:'week_goal',rest:'rest_seconds',unit:'unit',theme:'theme',notifications:'notifications',schedule:'schedule'},o={};
  Object.keys(p).forEach(k=>{if(m[k])o[m[k]]=(k==='goal'||k==='startDate')&&p[k]===''?null:p[k]});
  return o;
}

const api={
  async loadAll(uid){
    const [prof,exs,ws,wes,ss,ses,sets]=await Promise.all([
      sb.from('profiles').select('*').eq('id',uid).maybeSingle().then(must),
      fetchAll((a,b)=>sb.from('exercises').select('*').order('id').range(a,b)),
      fetchAll((a,b)=>sb.from('workouts').select('*').order('created_at').order('id').range(a,b)),
      fetchAll((a,b)=>sb.from('workout_exercises').select('*').order('id').range(a,b)),
      fetchAll((a,b)=>sb.from('sessions').select('*').order('id').range(a,b)),
      fetchAll((a,b)=>sb.from('session_exercises').select('*').order('id').range(a,b)),
      fetchAll((a,b)=>sb.from('session_sets').select('*').order('id').range(a,b))
    ]);
    if(!prof)throw {message:'Perfil não encontrado. Rode o supabase/schema.sql completo e entre de novo.',code:'NOPROFILE'};
    const all=exs.map(mapEx),look=id=>all.find(e=>e.id===id);
    const act=ss.filter(s=>s.status==='em_andamento'&&s.draft).sort((a,b)=>String(b.started_at).localeCompare(String(a.started_at)))[0];
    /* ciclos e atividades extras: se as tabelas novas ainda não existem no banco, o resto do app segue funcionando */
    let cycles=[],extras=[],cyclesReady=true;
    try{[cycles,extras]=await Promise.all([api.loadCycles(),api.loadExtras()])}
    catch(e){if(isNetErr(e))throw e;cyclesReady=false}
    return {profile:mapProfile(prof),stdEx:all.filter(e=>e.std),exercises:all.filter(e=>!e.std),
      workouts:mapWorkouts(ws,wes,look),sessions:mapSessions(ss,ses,sets),cycles:cycles,extras:extras,cyclesReady:cyclesReady,
      active:act?Object.assign({},act.draft,{id:act.id}):null,ts:Date.now()};
  },
  async loadCycles(){return (await fetchAll((a,b)=>sb.from('training_cycles').select('*').order('created_at').order('id').range(a,b))).map(mapCycle)},
  async loadExtras(){return (await fetchAll((a,b)=>sb.from('extra_activities').select('*').order('activity_date',{ascending:false}).order('id').range(a,b))).map(mapExtra)},
  async insertCycle(c){must(await sb.from('training_cycles').insert(cycleRow(c)))},
  async updateCycle(id,patch){must(await sb.from('training_cycles').update(cycleRow(patch)).eq('id',id))},
  async insertExtra(x){must(await sb.from('extra_activities').insert({activity_type:x.type,activity_date:x.date,duration_min:x.durationMin,notes:x.notes||''}))},
  async deleteExtra(id){must(await sb.from('extra_activities').delete().eq('id',id))},
  async loadWorkouts(look){
    const [ws,wes]=await Promise.all([
      fetchAll((a,b)=>sb.from('workouts').select('*').order('created_at').order('id').range(a,b)),
      fetchAll((a,b)=>sb.from('workout_exercises').select('*').order('id').range(a,b))]);
    return mapWorkouts(ws,wes,look);
  },
  async loadCustomExercises(){
    const rows=await fetchAll((a,b)=>sb.from('exercises').select('*').not('user_id','is',null).order('id').range(a,b));
    return rows.map(mapEx);
  },
  async saveProfile(patch){must(await sb.from('profiles').update(profilePatch(patch)).eq('id',S.uid))},
  async usernameAvailable(u){return must(await sb.rpc('username_available',{p_username:u}))===true},
  async emailForUsername(u){return must(await sb.rpc('email_for_username',{p_username:u}))},
  async saveWorkout(payload){return must(await sb.rpc('save_workout',{p:payload}))},
  async deleteWorkout(id){must(await sb.from('workouts').delete().eq('id',id))},
  async setLoad(workoutId,exerciseId,load){must(await sb.from('workout_exercises').update({load:load}).eq('workout_id',workoutId).eq('exercise_id',exerciseId))},
  async insertExercise(row){return mapEx(must(await sb.from('exercises').insert(Object.assign({user_id:S.uid},row)).select().single()))},
  async updateExercise(id,row){must(await sb.from('exercises').update(row).eq('id',id))},
  async archiveExercise(id){must(await sb.from('exercises').update({archived_at:new Date().toISOString()}).eq('id',id))},
  async saveDraft(ses){
    const wid=S.workouts.some(w=>w.id===ses.workoutId)?ses.workoutId:null;
    must(await sb.from('sessions').upsert({id:ses.id,workout_id:wid,workout_name:ses.workoutName,session_date:ses.date,status:'em_andamento',started_at:ses.startedAt,draft:ses},{onConflict:'id'}));
  },
  async finishSession(payload){return must(await sb.rpc('finish_session',{p:payload}))},
  async deleteSession(id){must(await sb.from('sessions').delete().eq('id',id))},
  async wipeSessions(){must(await sb.from('sessions').delete().eq('user_id',S.uid))},

  /* cópia local dos dados para abrir sem internet */
  cacheKey:uid=>'cds.cache.'+uid,
  cacheSave(uid,data){try{localStorage.setItem(api.cacheKey(uid),JSON.stringify(data));localStorage.setItem('cds.lastuid',uid)}catch(e){}},
  cacheLoad(uid){try{const v=localStorage.getItem(api.cacheKey(uid));return v?JSON.parse(v):null}catch(e){return null}},
  cacheClear(uid){try{localStorage.removeItem(api.cacheKey(uid));if(localStorage.getItem('cds.lastuid')===uid)localStorage.removeItem('cds.lastuid')}catch(e){}}
};
