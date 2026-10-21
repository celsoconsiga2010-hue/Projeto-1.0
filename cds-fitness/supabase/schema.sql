-- =====================================================================
-- CDS Fitness · banco de dados para Supabase (PostgreSQL 15 ou mais novo)
--
-- Como usar: Supabase > SQL Editor > New query > cole este arquivo > Run.
-- Pode rodar de novo sem perder dados (tudo usa "if not exists" ou
-- "create or replace").
--
-- Segurança: toda tabela tem Row Level Security (RLS). Cada usuário só lê
-- e grava as próprias linhas. O catálogo padrão de exercícios é somente
-- leitura para quem está logado.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABELAS
-- ---------------------------------------------------------------------

-- Perfil e configurações (1 linha por usuário; criada por trigger no cadastro)
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null,
  full_name     text not null,
  goal          text,
  start_date    date,
  week_goal     int  not null default 4,
  unit          text not null default 'kg',
  rest_seconds  int  not null default 90,
  theme         text not null default 'dark',
  notifications boolean not null default false,
  schedule      jsonb not null default '{}'::jsonb,   -- {"d1": "<id do treino>", ...} d0=domingo
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint profiles_username_fmt check (username ~ '^[a-z0-9_.-]{3,24}$'),
  constraint profiles_name_len     check (char_length(btrim(full_name)) between 1 and 120),
  constraint profiles_week_goal    check (week_goal between 1 and 7),
  constraint profiles_unit         check (unit in ('kg', 'lb')),
  constraint profiles_rest         check (rest_seconds between 10 and 600),
  constraint profiles_theme        check (theme in ('dark', 'light')),
  constraint profiles_schedule_obj check (jsonb_typeof(schedule) = 'object')
);
create unique index if not exists profiles_username_key on public.profiles (username);

-- Catálogo de exercícios. user_id nulo = exercício padrão (somente leitura).
-- Exercícios do usuário nunca são apagados de verdade: ficam arquivados
-- (archived_at) para o histórico continuar completo.
create table if not exists public.exercises (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid references public.profiles(id) on delete cascade,
  slug             text,
  name             text not null,
  muscle_group     text not null,
  secondary_groups text[] not null default '{}',
  equipment        text not null,
  description      text not null default '',
  notes            text not null default '',
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  constraint exercises_name_len  check (char_length(btrim(name)) between 1 and 120),
  constraint exercises_equipment check (equipment in ('Barra','Halteres','Máquinas','Polias','Peso corporal','Elásticos','Outros')),
  constraint exercises_group     check (muscle_group in ('Peito','Costas','Ombros','Bíceps','Tríceps','Antebraço','Abdômen','Quadríceps','Posterior de coxa','Glúteos','Panturrilha','Corpo inteiro')),
  constraint exercises_secondary check (secondary_groups <@ array['Peito','Costas','Ombros','Bíceps','Tríceps','Antebraço','Abdômen','Quadríceps','Posterior de coxa','Glúteos','Panturrilha','Corpo inteiro']::text[]),
  constraint exercises_slug_rule check ((user_id is null) = (slug is not null))
);
create unique index if not exists exercises_global_slug on public.exercises (slug) where user_id is null;
create unique index if not exists exercises_user_name   on public.exercises (user_id, lower(name)) where user_id is not null and archived_at is null;

-- Treinos (planejamento)
create table if not exists public.workouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name        text not null,
  description text not null default '',
  goal        text not null default '',
  muscles     text[] not null default '{}',
  notes       text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (id, user_id),
  constraint workouts_name_len check (char_length(btrim(name)) between 1 and 80)
);
create index if not exists workouts_user_idx on public.workouts (user_id, created_at);

-- Exercícios dentro de cada treino (parâmetros PLANEJADOS)
create table if not exists public.workout_exercises (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null default auth.uid(),
  workout_id      uuid not null,
  exercise_id     uuid not null references public.exercises(id),
  position        int  not null,
  sets            int  not null default 3,
  rep_min         int  not null default 8,
  rep_max         int  not null default 12,
  load            numeric(7,2),
  rest_seconds    int  not null default 90,
  progression_inc numeric(5,2) not null default 2.5,
  notes           text not null default '',
  foreign key (workout_id, user_id) references public.workouts(id, user_id) on delete cascade,
  constraint we_sets  check (sets between 1 and 20),
  constraint we_reps  check (rep_min between 1 and 100 and rep_max >= rep_min and rep_max <= 200),
  constraint we_load  check (load is null or load >= 0),
  constraint we_rest  check (rest_seconds between 0 and 900),
  constraint we_inc   check (progression_inc > 0 and progression_inc <= 100)
);
create index if not exists we_workout_idx on public.workout_exercises (workout_id, position);
create index if not exists we_user_idx    on public.workout_exercises (user_id);

-- Sessões de treino (execução). Enquanto está em andamento, o rascunho fica
-- em "draft" (autosave). Ao finalizar, os dados viram linhas em
-- session_exercises e session_sets e o rascunho é limpo.
create table if not exists public.sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  workout_id       uuid references public.workouts(id) on delete set null,
  workout_name     text not null,
  session_date     date not null default current_date,
  status           text not null default 'em_andamento',
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,
  duration_seconds int,
  total_volume     numeric(12,2) not null default 0,
  notes            text not null default '',
  draft            jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (id, user_id),
  constraint sessions_status check (status in ('em_andamento', 'concluida')),
  constraint sessions_done   check (status = 'em_andamento' or ended_at is not null),
  constraint sessions_dur    check (duration_seconds is null or duration_seconds >= 0)
);
create index if not exists sessions_user_idx on public.sessions (user_id, status, started_at desc);

-- Exercícios realizados na sessão (guarda o nome na época: o histórico não muda
-- se o treino ou o exercício forem editados depois)
create table if not exists public.session_exercises (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid(),
  session_id       uuid not null,
  exercise_id      uuid not null references public.exercises(id),
  exercise_name    text not null,
  muscle_group     text not null default '',
  position         int  not null,
  planned_sets     int,
  planned_rep_min  int,
  planned_rep_max  int,
  planned_load     numeric(7,2),
  notes            text not null default '',
  unique (id, user_id),
  foreign key (session_id, user_id) references public.sessions(id, user_id) on delete cascade
);
create index if not exists se_session_idx  on public.session_exercises (session_id, position);
create index if not exists se_exercise_idx on public.session_exercises (user_id, exercise_id);

-- Séries executadas (carga e repetições reais)
create table if not exists public.session_sets (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid(),
  session_exercise_id uuid not null,
  set_number          int  not null,
  load                numeric(7,2) not null,
  reps                int  not null,
  completed           boolean not null default true,
  created_at          timestamptz not null default now(),
  foreign key (session_exercise_id, user_id) references public.session_exercises(id, user_id) on delete cascade,
  unique (session_exercise_id, set_number),
  constraint ss_load check (load >= 0),
  constraint ss_reps check (reps between 1 and 1000)
);
create index if not exists ss_user_idx on public.session_sets (user_id, session_exercise_id);

-- Histórico de cargas por exercício (só sessões concluídas). Respeita a RLS.
create or replace view public.exercise_history with (security_invoker = true) as
select ss.user_id,
       se.exercise_id,
       se.exercise_name,
       s.id           as session_id,
       s.workout_name,
       s.session_date,
       s.started_at,
       ss.set_number,
       ss.load,
       ss.reps,
       (ss.load * ss.reps) as volume
from public.session_sets ss
join public.session_exercises se on se.id = ss.session_exercise_id
join public.sessions s           on s.id  = se.session_id
where s.status = 'concluida' and ss.completed;

-- ---------------------------------------------------------------------
-- 2. updated_at automático
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_updated  on public.profiles;
create trigger profiles_updated  before update on public.profiles  for each row execute function public.set_updated_at();
drop trigger if exists workouts_updated  on public.workouts;
create trigger workouts_updated  before update on public.workouts  for each row execute function public.set_updated_at();
drop trigger if exists sessions_updated  on public.sessions;
create trigger sessions_updated  before update on public.sessions  for each row execute function public.set_updated_at();

-- Uma sessão finalizada não volta a "em andamento" (protege contra um
-- autosave atrasado, por exemplo de outro aparelho).
create or replace function public.sessions_keep_finished()
returns trigger language plpgsql as $$
begin
  if old.status = 'concluida' and new.status = 'em_andamento' then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists sessions_keep_finished on public.sessions;
create trigger sessions_keep_finished before update on public.sessions for each row execute function public.sessions_keep_finished();

-- ---------------------------------------------------------------------
-- 3. Cadastro: cria o perfil quando nasce um usuário no Supabase Auth
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_user text;
  v_name text;
begin
  v_user := lower(btrim(coalesce(new.raw_user_meta_data ->> 'username', '')));
  if v_user = '' then
    -- usuário criado pelo painel ou por convite: gera um nome a partir do e-mail
    v_user := left(regexp_replace(lower(split_part(coalesce(new.email, 'atleta'), '@', 1)), '[^a-z0-9_.-]', '', 'g'), 19)
              || substr(md5(random()::text), 1, 4);
  end if;
  v_name := btrim(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(new.email, 'Atleta'), '@', 1)));
  insert into public.profiles (id, username, full_name, start_date)
  values (new.id, v_user, left(v_name, 120), current_date);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Contas que já existiam antes de este arquivo ser rodado ganham um perfil.
insert into public.profiles (id, username, full_name, start_date)
select u.id,
       case when lower(btrim(coalesce(u.raw_user_meta_data ->> 'username', ''))) ~ '^[a-z0-9_.-]{3,24}$'
            then lower(btrim(u.raw_user_meta_data ->> 'username'))
            else left(regexp_replace(lower(split_part(coalesce(u.email, 'atleta'), '@', 1)), '[^a-z0-9_.-]', '', 'g'), 19) || substr(md5(u.id::text), 1, 4)
       end,
       left(btrim(coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(u.email, 'Atleta'), '@', 1))), 120),
       current_date
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

-- Login por nome de usuário: devolve o e-mail da conta (a senha continua sendo
-- conferida pelo Supabase Auth). ATENÇÃO: isso permite descobrir o e-mail de
-- quem você conhece o usuário. Se não quiser isso, apague a função abaixo e
-- ponha allowUsernameLogin: false no js/config.js.
create or replace function public.email_for_username(p_username text)
returns text language sql stable security definer set search_path = public, auth as $$
  select u.email::text
  from public.profiles p
  join auth.users u on u.id = p.id
  where p.username = lower(btrim(p_username))
  limit 1
$$;

-- Cadastro: verifica se o nome de usuário está livre
create or replace function public.username_available(p_username text)
returns boolean language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where username = lower(btrim(p_username)))
$$;

-- ---------------------------------------------------------------------
-- 4. Funções atômicas (tudo ou nada). Rodam com os direitos de quem chama,
--    então a RLS continua valendo.
-- ---------------------------------------------------------------------

-- Cria ou atualiza um treino e substitui a lista de exercícios dele.
create or replace function public.save_workout(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id  uuid;
  v_ex  jsonb;
  v_pos int := 0;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  v_id := coalesce(nullif(p ->> 'id', '')::uuid, gen_random_uuid());

  insert into public.workouts (id, user_id, name, description, goal, muscles, notes)
  values (v_id, v_uid, btrim(p ->> 'name'), coalesce(p ->> 'description', ''), coalesce(p ->> 'goal', ''),
          array(select jsonb_array_elements_text(coalesce(p -> 'muscles', '[]'::jsonb))),
          coalesce(p ->> 'notes', ''))
  on conflict (id) do update
    set name = excluded.name, description = excluded.description, goal = excluded.goal,
        muscles = excluded.muscles, notes = excluded.notes
    where public.workouts.user_id = v_uid;

  delete from public.workout_exercises where workout_id = v_id and user_id = v_uid;

  for v_ex in select e from jsonb_array_elements(coalesce(p -> 'exercises', '[]'::jsonb)) as e loop
    v_pos := v_pos + 1;
    insert into public.workout_exercises
      (user_id, workout_id, exercise_id, position, sets, rep_min, rep_max, load, rest_seconds, progression_inc, notes)
    values
      (v_uid, v_id, (v_ex ->> 'exercise_id')::uuid, v_pos,
       coalesce((v_ex ->> 'sets')::int, 3),
       coalesce((v_ex ->> 'rep_min')::int, 8),
       coalesce((v_ex ->> 'rep_max')::int, 12),
       nullif(v_ex ->> 'load', '')::numeric,
       coalesce((v_ex ->> 'rest_seconds')::int, 90),
       coalesce((v_ex ->> 'progression_inc')::numeric, 2.5),
       coalesce(v_ex ->> 'notes', ''));
  end loop;

  return v_id;
end $$;

-- Finaliza uma sessão: grava exercícios e séries e limpa o rascunho.
-- Pode ser chamada de novo com o mesmo id sem duplicar nada.
create or replace function public.finish_session(p jsonb)
returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_uid  uuid := auth.uid();
  v_id   uuid;
  v_ex   jsonb;
  v_set  jsonb;
  v_se   uuid;
  v_pos  int := 0;
  v_n    int;
  v_sets int := 0;
  v_vol  numeric := 0;
begin
  if v_uid is null then
    raise exception 'Não autenticado' using errcode = '28000';
  end if;
  v_id := (p ->> 'id')::uuid;

  insert into public.sessions
    (id, user_id, workout_id, workout_name, session_date, status, started_at, ended_at, duration_seconds, notes, draft)
  values
    (v_id, v_uid,
     (select w.id from public.workouts w where w.id = nullif(p ->> 'workout_id', '')::uuid),
     btrim(p ->> 'workout_name'),
     (p ->> 'session_date')::date,
     'concluida',
     (p ->> 'started_at')::timestamptz,
     coalesce((p ->> 'ended_at')::timestamptz, now()),
     nullif(p ->> 'duration_seconds', '')::int,
     coalesce(p ->> 'notes', ''),
     null)
  on conflict (id) do update
    set workout_id = excluded.workout_id, workout_name = excluded.workout_name,
        session_date = excluded.session_date, status = 'concluida',
        started_at = excluded.started_at, ended_at = excluded.ended_at,
        duration_seconds = excluded.duration_seconds, notes = excluded.notes, draft = null
    where public.sessions.user_id = v_uid;

  delete from public.session_exercises where session_id = v_id and user_id = v_uid;

  for v_ex in select e from jsonb_array_elements(coalesce(p -> 'exercises', '[]'::jsonb)) as e loop
    if jsonb_array_length(coalesce(v_ex -> 'sets', '[]'::jsonb)) = 0 then
      continue;
    end if;
    v_pos := v_pos + 1;
    insert into public.session_exercises
      (user_id, session_id, exercise_id, exercise_name, muscle_group, position,
       planned_sets, planned_rep_min, planned_rep_max, planned_load, notes)
    values
      (v_uid, v_id, (v_ex ->> 'exercise_id')::uuid, btrim(v_ex ->> 'name'),
       coalesce(v_ex ->> 'group', ''), v_pos,
       nullif(v_ex ->> 'planned_sets', '')::int, nullif(v_ex ->> 'planned_rep_min', '')::int,
       nullif(v_ex ->> 'planned_rep_max', '')::int, nullif(v_ex ->> 'planned_load', '')::numeric,
       coalesce(v_ex ->> 'notes', ''))
    returning id into v_se;

    v_n := 0;
    for v_set in select s from jsonb_array_elements(v_ex -> 'sets') as s loop
      v_n := v_n + 1;
      insert into public.session_sets (user_id, session_exercise_id, set_number, load, reps, completed)
      values (v_uid, v_se, v_n, (v_set ->> 'load')::numeric, (v_set ->> 'reps')::int, true);
      v_vol  := v_vol + (v_set ->> 'load')::numeric * (v_set ->> 'reps')::int;
      v_sets := v_sets + 1;
    end loop;
  end loop;

  if v_sets = 0 then
    raise exception 'Conclua ao menos uma série antes de finalizar.' using errcode = 'P0001';
  end if;

  update public.sessions set total_volume = v_vol where id = v_id and user_id = v_uid;
  return v_id;
end $$;

-- ---------------------------------------------------------------------
-- 5. SEGURANÇA (RLS) E PERMISSÕES
-- ---------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.exercises         enable row level security;
alter table public.workouts          enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sessions          enable row level security;
alter table public.session_exercises enable row level security;
alter table public.session_sets      enable row level security;

-- profiles: lê e edita só o próprio. Não há insert/delete pelo app
-- (o perfil nasce pelo trigger e some junto com a conta).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()));
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- exercises: todos veem os padrão (user_id nulo) e os próprios;
-- só mexem nos próprios.
drop policy if exists exercises_select on public.exercises;
create policy exercises_select on public.exercises for select to authenticated
  using (user_id is null or user_id = (select auth.uid()));
drop policy if exists exercises_insert on public.exercises;
create policy exercises_insert on public.exercises for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists exercises_update on public.exercises;
create policy exercises_update on public.exercises for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists exercises_delete on public.exercises;
create policy exercises_delete on public.exercises for delete to authenticated
  using (user_id = (select auth.uid()));

-- demais tabelas: acesso total, mas só às próprias linhas
do $$
declare t text;
begin
  foreach t in array array['workouts','workout_exercises','sessions','session_exercises','session_sets'] loop
    execute format('drop policy if exists %I on public.%I', t || '_own', t);
    execute format(
      'create policy %I on public.%I for all to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_own', t);
  end loop;
end $$;

-- permissões explícitas: visitante sem login (anon) não acessa nenhuma tabela
revoke all on public.profiles, public.exercises, public.workouts, public.workout_exercises,
              public.sessions, public.session_exercises, public.session_sets, public.exercise_history
  from anon, public;
grant select, update                 on public.profiles          to authenticated;
grant select, insert, update, delete on public.exercises         to authenticated;
grant select, insert, update, delete on public.workouts          to authenticated;
grant select, insert, update, delete on public.workout_exercises to authenticated;
grant select, insert, update, delete on public.sessions          to authenticated;
grant select, insert, update, delete on public.session_exercises to authenticated;
grant select, insert, update, delete on public.session_sets      to authenticated;
grant select                         on public.exercise_history  to authenticated;

revoke all on function public.save_workout(jsonb)       from public, anon;
revoke all on function public.finish_session(jsonb)     from public, anon;
revoke all on function public.email_for_username(text)  from public;
revoke all on function public.username_available(text) from public;
grant execute on function public.save_workout(jsonb)       to authenticated;
grant execute on function public.finish_session(jsonb)     to authenticated;
grant execute on function public.email_for_username(text)  to anon, authenticated;
grant execute on function public.username_available(text)  to anon, authenticated;

-- ---------------------------------------------------------------------
-- 5b. CICLOS DE TREINO E ATIVIDADES EXTRAS (acréscimo; não altera nenhuma
--     tabela existente e não mexe em dados já cadastrados)
-- ---------------------------------------------------------------------

-- Ciclo de treino: sequência de treinos (A, B, C...) com prazo. As sessões
-- NÃO são copiadas nem alteradas: o app conta as sessões concluídas a partir
-- da data de início. Ao concluir o ciclo, um resumo fica guardado em "summary"
-- e os treinos usados em "workouts_snapshot", então o histórico do ciclo
-- continua completo mesmo que treinos ou sessões sejam editados ou apagados.
create table if not exists public.training_cycles (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  name              text not null default 'Ciclo',
  workout_ids       jsonb not null default '[]'::jsonb,   -- ids dos treinos, na ordem da sequência
  rounds            int  not null default 1,              -- voltas completas da sequência
  total_sessions    int  not null default 1,
  start_date        date not null default current_date,
  deadline          date not null,
  days_per_week     int  not null default 3,
  auto_close        boolean not null default true,
  status            text not null default 'ativo',
  end_date          date,
  completion        text,                                 -- manual | auto-sessoes | auto-prazo
  summary           jsonb,
  workouts_snapshot jsonb not null default '[]'::jsonb,
  handled           boolean not null default false,       -- true depois de renovar ou dispensar
  renew_of          uuid,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint tc_name_len   check (char_length(btrim(name)) between 1 and 80),
  constraint tc_status     check (status in ('ativo', 'concluido')),
  constraint tc_rounds     check (rounds between 1 and 52),
  constraint tc_total      check (total_sessions between 1 and 1000),
  constraint tc_dpw        check (days_per_week between 1 and 7),
  constraint tc_dates      check (deadline > start_date),
  constraint tc_ids_arr    check (jsonb_typeof(workout_ids) = 'array' and jsonb_typeof(workouts_snapshot) = 'array'),
  constraint tc_done_end   check (status = 'ativo' or end_date is not null)
);
create index if not exists tc_user_idx on public.training_cycles (user_id, status, start_date desc);
-- no máximo um ciclo em andamento por pessoa
create unique index if not exists tc_one_active on public.training_cycles (user_id) where status = 'ativo';

-- Atividades extras (futebol, corrida, natação, lutas...)
create table if not exists public.extra_activities (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  activity_type text not null,
  activity_date date not null default current_date,
  duration_min  int  not null,
  notes         text not null default '',
  created_at    timestamptz not null default now(),
  constraint ea_type_len check (char_length(btrim(activity_type)) between 1 and 60),
  constraint ea_dur      check (duration_min between 1 and 600),
  constraint ea_notes    check (char_length(notes) <= 500)
);
create index if not exists ea_user_idx on public.extra_activities (user_id, activity_date desc);

drop trigger if exists tc_updated on public.training_cycles;
create trigger tc_updated before update on public.training_cycles for each row execute function public.set_updated_at();

alter table public.training_cycles enable row level security;
alter table public.extra_activities enable row level security;

drop policy if exists training_cycles_own on public.training_cycles;
create policy training_cycles_own on public.training_cycles for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists extra_activities_own on public.extra_activities;
create policy extra_activities_own on public.extra_activities for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on public.training_cycles, public.extra_activities from anon, public;
grant select, insert, update, delete on public.training_cycles  to authenticated;
grant select, insert, update, delete on public.extra_activities to authenticated;

-- ---------------------------------------------------------------------
-- 6. CATÁLOGO PADRÃO DE EXERCÍCIOS
-- ---------------------------------------------------------------------
insert into public.exercises (slug, name, muscle_group, secondary_groups, equipment)
values
  ('supino-reto-com-barra', 'Supino reto com barra', 'Peito', array['Tríceps','Ombros']::text[], 'Barra'),
  ('supino-reto-com-halteres', 'Supino reto com halteres', 'Peito', array['Tríceps','Ombros']::text[], 'Halteres'),
  ('supino-inclinado-com-halteres', 'Supino inclinado com halteres', 'Peito', array['Ombros','Tríceps']::text[], 'Halteres'),
  ('crucifixo-na-maquina-peck-deck', 'Crucifixo na máquina (peck deck)', 'Peito', '{}'::text[], 'Máquinas'),
  ('crossover-na-polia', 'Crossover na polia', 'Peito', '{}'::text[], 'Polias'),
  ('flexao-de-braco', 'Flexão de braço', 'Peito', array['Tríceps','Ombros']::text[], 'Peso corporal'),
  ('barra-fixa', 'Barra fixa', 'Costas', array['Bíceps']::text[], 'Peso corporal'),
  ('remada-curvada-com-barra', 'Remada curvada com barra', 'Costas', array['Bíceps']::text[], 'Barra'),
  ('puxada-frontal-na-polia', 'Puxada frontal na polia', 'Costas', array['Bíceps']::text[], 'Polias'),
  ('remada-baixa-na-polia', 'Remada baixa na polia', 'Costas', array['Bíceps']::text[], 'Polias'),
  ('remada-unilateral-com-halter', 'Remada unilateral com halter', 'Costas', array['Bíceps']::text[], 'Halteres'),
  ('levantamento-terra', 'Levantamento terra', 'Costas', array['Glúteos','Posterior de coxa']::text[], 'Barra'),
  ('remada-com-elastico', 'Remada com elástico', 'Costas', array['Bíceps']::text[], 'Elásticos'),
  ('desenvolvimento-com-halteres', 'Desenvolvimento com halteres', 'Ombros', array['Tríceps']::text[], 'Halteres'),
  ('desenvolvimento-com-barra', 'Desenvolvimento com barra', 'Ombros', array['Tríceps']::text[], 'Barra'),
  ('elevacao-lateral-com-halteres', 'Elevação lateral com halteres', 'Ombros', '{}'::text[], 'Halteres'),
  ('elevacao-frontal-com-halteres', 'Elevação frontal com halteres', 'Ombros', '{}'::text[], 'Halteres'),
  ('crucifixo-inverso-na-maquina', 'Crucifixo inverso na máquina', 'Ombros', array['Costas']::text[], 'Máquinas'),
  ('rosca-direta-com-barra', 'Rosca direta com barra', 'Bíceps', array['Antebraço']::text[], 'Barra'),
  ('rosca-alternada-com-halteres', 'Rosca alternada com halteres', 'Bíceps', array['Antebraço']::text[], 'Halteres'),
  ('rosca-martelo', 'Rosca martelo', 'Bíceps', array['Antebraço']::text[], 'Halteres'),
  ('rosca-na-polia', 'Rosca na polia', 'Bíceps', '{}'::text[], 'Polias'),
  ('triceps-testa-com-barra', 'Tríceps testa com barra', 'Tríceps', '{}'::text[], 'Barra'),
  ('triceps-na-polia-corda', 'Tríceps na polia (corda)', 'Tríceps', '{}'::text[], 'Polias'),
  ('triceps-frances-com-halter', 'Tríceps francês com halter', 'Tríceps', '{}'::text[], 'Halteres'),
  ('mergulho-entre-bancos', 'Mergulho entre bancos', 'Tríceps', array['Peito']::text[], 'Peso corporal'),
  ('rosca-de-punho', 'Rosca de punho', 'Antebraço', '{}'::text[], 'Barra'),
  ('abdominal-na-maquina', 'Abdominal na máquina', 'Abdômen', '{}'::text[], 'Máquinas'),
  ('abdominal-supra-no-solo', 'Abdominal supra no solo', 'Abdômen', '{}'::text[], 'Peso corporal'),
  ('prancha', 'Prancha', 'Abdômen', '{}'::text[], 'Peso corporal'),
  ('elevacao-de-pernas', 'Elevação de pernas', 'Abdômen', '{}'::text[], 'Peso corporal'),
  ('agachamento-livre', 'Agachamento livre', 'Quadríceps', array['Glúteos','Posterior de coxa']::text[], 'Barra'),
  ('leg-press-45', 'Leg press 45°', 'Quadríceps', array['Glúteos']::text[], 'Máquinas'),
  ('cadeira-extensora', 'Cadeira extensora', 'Quadríceps', '{}'::text[], 'Máquinas'),
  ('agachamento-bulgaro', 'Agachamento búlgaro', 'Quadríceps', array['Glúteos']::text[], 'Halteres'),
  ('afundo-com-halteres', 'Afundo com halteres', 'Quadríceps', array['Glúteos']::text[], 'Halteres'),
  ('mesa-flexora', 'Mesa flexora', 'Posterior de coxa', '{}'::text[], 'Máquinas'),
  ('stiff-com-barra', 'Stiff com barra', 'Posterior de coxa', array['Glúteos']::text[], 'Barra'),
  ('cadeira-flexora', 'Cadeira flexora', 'Posterior de coxa', '{}'::text[], 'Máquinas'),
  ('elevacao-pelvica', 'Elevação pélvica', 'Glúteos', array['Posterior de coxa']::text[], 'Barra'),
  ('gluteo-na-polia-coice', 'Glúteo na polia (coice)', 'Glúteos', '{}'::text[], 'Polias'),
  ('cadeira-abdutora', 'Cadeira abdutora', 'Glúteos', '{}'::text[], 'Máquinas'),
  ('panturrilha-em-pe-na-maquina', 'Panturrilha em pé na máquina', 'Panturrilha', '{}'::text[], 'Máquinas'),
  ('panturrilha-sentado', 'Panturrilha sentado', 'Panturrilha', '{}'::text[], 'Máquinas'),
  ('burpee', 'Burpee', 'Corpo inteiro', '{}'::text[], 'Peso corporal'),
  ('kettlebell-swing', 'Kettlebell swing', 'Corpo inteiro', array['Glúteos']::text[], 'Outros')
on conflict (slug) where user_id is null do nothing;
