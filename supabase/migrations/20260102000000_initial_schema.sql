-- =========================
-- CanvasCast: Core Enums
-- =========================
do $$ begin
  create type public.project_status as enum ('draft', 'generating', 'ready', 'failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.job_status as enum (
    'QUEUED',
    'SCRIPTING',
    'TTS',
    'ALIGNMENT',
    'VISUALS',
    'REMOTION_RENDER',
    'PACKAGING',
    'READY',
    'FAILED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.asset_type as enum ('script','audio','image','captions','video','zip','timeline','outline','other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.ledger_type as enum ('purchase','reserve','release','spend','refund','admin_adjust');
exception when duplicate_object then null; end $$;

-- =========================
-- Helper: updated_at trigger
-- =========================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- =========================
-- Projects
-- =========================
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled Project',
  niche_preset text not null,
  target_minutes int not null default 10,
  status public.project_status not null default 'draft',
  timeline_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists projects_user_id_idx on public.projects(user_id);

drop trigger if exists trg_projects_updated_at on public.projects;
create trigger trg_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

-- =========================
-- Jobs
-- =========================
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  status public.job_status not null default 'QUEUED',
  progress int not null default 0 check (progress between 0 and 100),

  error_code text,
  error_message text,

  claimed_at timestamptz,
  claimed_by text,

  started_at timestamptz,
  finished_at timestamptz,

  cost_credits_reserved int not null default 0,
  cost_credits_final int not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists jobs_status_created_idx on public.jobs(status, created_at);
create index if not exists jobs_project_id_idx on public.jobs(project_id);
create index if not exists jobs_user_id_idx on public.jobs(user_id);

drop trigger if exists trg_jobs_updated_at on public.jobs;
create trigger trg_jobs_updated_at
before update on public.jobs
for each row execute function public.set_updated_at();

-- =========================
-- Assets (references Supabase Storage paths)
-- =========================
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,

  type public.asset_type not null,
  path text not null,
  meta jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now()
);

create index if not exists assets_project_id_idx on public.assets(project_id);
create index if not exists assets_user_id_idx on public.assets(user_id);

-- =========================
-- Credits ledger
-- =========================
create table if not exists public.credit_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete set null,
  type public.ledger_type not null,
  amount int not null,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists credit_ledger_user_id_idx on public.credit_ledger(user_id);
create index if not exists credit_ledger_job_id_idx on public.credit_ledger(job_id);

-- Convenience view for balance
create or replace view public.credit_balance as
select
  user_id,
  coalesce(sum(amount), 0) as balance
from public.credit_ledger
group by user_id;

-- =========================
-- Email Preferences
-- =========================
create table if not exists public.user_notification_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- transactional toggles
  email_job_started boolean not null default false,
  email_job_completed boolean not null default true,
  email_job_failed boolean not null default true,
  email_credits_low boolean not null default true,
  email_account_status boolean not null default true,

  -- marketing
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  marketing_opt_in_source text,
  marketing_unsubscribed_at timestamptz,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_prefs_updated_at on public.user_notification_prefs;
create trigger trg_prefs_updated_at
before update on public.user_notification_prefs
for each row execute function public.set_updated_at();

-- =========================
-- Email Log
-- =========================
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  job_id uuid references public.jobs(id) on delete set null,
  kind text not null,
  to_email text not null,
  subject text not null,
  resend_id text,
  status text not null default 'queued',
  error_message text,
  created_at timestamptz not null default now()
);

-- =========================
-- Voice Profiles (gated feature)
-- =========================
create table if not exists public.voice_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null default 'My Voice',
  status text not null default 'pending', -- pending, approved, rejected
  model_ref text,
  endpoint_ref text,
  samples_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists voice_profiles_user_id_idx on public.voice_profiles(user_id);

drop trigger if exists trg_voice_profiles_updated_at on public.voice_profiles;
create trigger trg_voice_profiles_updated_at
before update on public.voice_profiles
for each row execute function public.set_updated_at();

-- =========================
-- RLS Policies
-- =========================
alter table public.projects enable row level security;
alter table public.jobs enable row level security;
alter table public.assets enable row level security;
alter table public.credit_ledger enable row level security;
alter table public.user_notification_prefs enable row level security;
alter table public.email_log enable row level security;
alter table public.voice_profiles enable row level security;

-- Projects
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_own"
on public.projects for select
using (auth.uid() = user_id);

drop policy if exists "projects_insert_own" on public.projects;
create policy "projects_insert_own"
on public.projects for insert
with check (auth.uid() = user_id);

drop policy if exists "projects_update_own" on public.projects;
create policy "projects_update_own"
on public.projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "projects_delete_own" on public.projects;
create policy "projects_delete_own"
on public.projects for delete
using (auth.uid() = user_id);

-- Jobs
drop policy if exists "jobs_select_own" on public.jobs;
create policy "jobs_select_own"
on public.jobs for select
using (auth.uid() = user_id);

drop policy if exists "jobs_insert_own" on public.jobs;
create policy "jobs_insert_own"
on public.jobs for insert
with check (auth.uid() = user_id);

drop policy if exists "jobs_update_own" on public.jobs;
create policy "jobs_update_own"
on public.jobs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Assets
drop policy if exists "assets_select_own" on public.assets;
create policy "assets_select_own"
on public.assets for select
using (auth.uid() = user_id);

drop policy if exists "assets_insert_own" on public.assets;
create policy "assets_insert_own"
on public.assets for insert
with check (auth.uid() = user_id);

drop policy if exists "assets_update_own" on public.assets;
create policy "assets_update_own"
on public.assets for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Credits
drop policy if exists "ledger_select_own" on public.credit_ledger;
create policy "ledger_select_own"
on public.credit_ledger for select
using (auth.uid() = user_id);

drop policy if exists "ledger_insert_own" on public.credit_ledger;
create policy "ledger_insert_own"
on public.credit_ledger for insert
with check (auth.uid() = user_id);

-- Notification Prefs
drop policy if exists "prefs_select_own" on public.user_notification_prefs;
create policy "prefs_select_own"
on public.user_notification_prefs for select
using (auth.uid() = user_id);

drop policy if exists "prefs_upsert_own" on public.user_notification_prefs;
create policy "prefs_upsert_own"
on public.user_notification_prefs for insert
with check (auth.uid() = user_id);

drop policy if exists "prefs_update_own" on public.user_notification_prefs;
create policy "prefs_update_own"
on public.user_notification_prefs for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- Email Log
drop policy if exists "email_log_select_own" on public.email_log;
create policy "email_log_select_own"
on public.email_log for select
using (auth.uid() = user_id);

-- Voice Profiles
drop policy if exists "voice_profiles_select_own" on public.voice_profiles;
create policy "voice_profiles_select_own"
on public.voice_profiles for select
using (auth.uid() = user_id);

drop policy if exists "voice_profiles_insert_own" on public.voice_profiles;
create policy "voice_profiles_insert_own"
on public.voice_profiles for insert
with check (auth.uid() = user_id);

drop policy if exists "voice_profiles_update_own" on public.voice_profiles;
create policy "voice_profiles_update_own"
on public.voice_profiles for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================
-- SAFE JOB CLAIM FUNCTION (Worker uses SERVICE_ROLE key)
-- =========================
create or replace function public.claim_next_job(worker_name text)
returns public.jobs
language plpgsql
security definer
as $$
declare
  v_job public.jobs;
begin
  with next as (
    select id
    from public.jobs
    where status = 'QUEUED'
    order by created_at asc
    for update skip locked
    limit 1
  ),
  upd as (
    update public.jobs j
    set
      status = 'SCRIPTING',
      claimed_at = now(),
      claimed_by = worker_name,
      started_at = coalesce(started_at, now()),
      progress = greatest(progress, 1)
    from next
    where j.id = next.id
    returning j.*
  )
  select * into v_job from upd;

  return v_job;
end;
$$;

revoke all on function public.claim_next_job(text) from public;
grant execute on function public.claim_next_job(text) to anon, authenticated;

-- =========================
-- CREDIT HELPER FUNCTIONS
-- =========================
create or replace function public.reserve_credits(p_user_id uuid, p_job_id uuid, p_amount int)
returns void
language plpgsql
security definer
as $$
declare
  v_balance int;
begin
  select balance into v_balance from public.credit_balance where user_id = p_user_id;

  if coalesce(v_balance,0) < p_amount then
    raise exception 'Insufficient credits. Have %, need %', coalesce(v_balance,0), p_amount;
  end if;

  insert into public.credit_ledger(user_id, job_id, type, amount, note)
  values (p_user_id, p_job_id, 'reserve', -p_amount, 'Reserve credits for job');

  update public.jobs
  set cost_credits_reserved = p_amount
  where id = p_job_id;
end;
$$;

create or replace function public.release_reserved_credits(p_user_id uuid, p_job_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_reserved int;
begin
  select cost_credits_reserved into v_reserved from public.jobs where id = p_job_id;

  if coalesce(v_reserved,0) > 0 then
    insert into public.credit_ledger(user_id, job_id, type, amount, note)
    values (p_user_id, p_job_id, 'release', v_reserved, 'Release reserved credits');
  end if;

  update public.jobs set cost_credits_reserved = 0 where id = p_job_id;
end;
$$;

create or replace function public.finalize_credits(p_user_id uuid, p_job_id uuid, p_final_cost int)
returns void
language plpgsql
security definer
as $$
declare
  v_reserved int;
  v_delta int;
begin
  select cost_credits_reserved into v_reserved from public.jobs where id = p_job_id;

  v_delta := coalesce(v_reserved,0) - p_final_cost;

  if v_delta > 0 then
    insert into public.credit_ledger(user_id, job_id, type, amount, note)
    values (p_user_id, p_job_id, 'release', v_delta, 'Refund unused reserved credits');
  end if;

  update public.jobs
  set cost_credits_final = p_final_cost,
      cost_credits_reserved = 0
  where id = p_job_id;
end;
$$;

-- Add credits to user (for purchases or admin adjustments)
create or replace function public.add_credits(p_user_id uuid, p_amount int, p_type public.ledger_type, p_note text default null)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.credit_ledger(user_id, type, amount, note)
  values (p_user_id, p_type, p_amount, p_note);
end;
$$;

-- Get user credit balance
create or replace function public.get_credit_balance(p_user_id uuid)
returns int
language plpgsql
security definer
as $$
declare
  v_balance int;
begin
  select coalesce(sum(amount), 0) into v_balance
  from public.credit_ledger
  where user_id = p_user_id;
  
  return v_balance;
end;
$$;

revoke all on function public.reserve_credits(uuid,uuid,int) from public;
revoke all on function public.release_reserved_credits(uuid,uuid) from public;
revoke all on function public.finalize_credits(uuid,uuid,int) from public;
revoke all on function public.add_credits(uuid,int,public.ledger_type,text) from public;
revoke all on function public.get_credit_balance(uuid) from public;

grant execute on function public.reserve_credits(uuid,uuid,int) to anon, authenticated;
grant execute on function public.release_reserved_credits(uuid,uuid) to anon, authenticated;
grant execute on function public.finalize_credits(uuid,uuid,int) to anon, authenticated;
grant execute on function public.add_credits(uuid,int,public.ledger_type,text) to anon, authenticated;
grant execute on function public.get_credit_balance(uuid) to anon, authenticated;

-- =========================
-- Storage Buckets (run via dashboard or CLI)
-- =========================
-- Note: Create these buckets in Supabase Studio:
-- 1. project-assets (private) - images, audio segments, timeline
-- 2. project-outputs (private) - final.mp4, captions, zip
