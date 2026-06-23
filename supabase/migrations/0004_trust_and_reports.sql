-- ============================================================================
-- GameHub — Migration 0004: Trust Score + Reports system
-- Run this AFTER 0001, 0002, 0003 in the Supabase SQL Editor.
-- ============================================================================

-- Enum types --------------------------------------------------------------
create type report_target_type as enum ('post', 'reply', 'user', 'room');
create type report_status as enum ('pending', 'valid', 'invalid');

-- reports -------------------------------------------------------------------
create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type report_target_type not null,
  target_id uuid not null,
  -- Denormalized so admins can see who/what was reported without a
  -- polymorphic join — populated by the app at insert time.
  target_user_id uuid references public.profiles (id) on delete cascade,
  reason text not null check (char_length(reason) between 5 and 500),
  status report_status not null default 'pending',
  trust_penalty smallint check (trust_penalty between 0 and 100),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_target_user_idx on public.reports (target_user_id);

-- trust_score_logs (audit trail of every trust score change) ----------------
create table public.trust_score_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  delta smallint not null,
  reason text not null,
  related_report_id uuid references public.reports (id) on delete set null,
  created_at timestamptz not null default now()
);

create index trust_score_logs_user_id_idx on public.trust_score_logs (user_id, created_at desc);

-- ============================================================================
-- Function: apply a trust score delta safely (clamped 0–100) and log it.
-- ============================================================================

create function public.adjust_trust_score(
  p_user_id uuid,
  p_delta smallint,
  p_reason text,
  p_related_report_id uuid default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  update public.profiles
  set trust_score = greatest(0, least(100, trust_score + p_delta))
  where id = p_user_id;

  insert into public.trust_score_logs (user_id, delta, reason, related_report_id)
  values (p_user_id, p_delta, p_reason, p_related_report_id);
end;
$$;

-- ============================================================================
-- Function: admin resolves a report (marks valid/invalid and applies the
-- trust score consequences in one atomic operation).
--   - valid:   target user loses `p_penalty` points, reporter gains a
--              small fixed reward (+2, capped at 100).
--   - invalid: reporter loses a small fixed penalty (-3), target is
--              untouched.
-- Only callable by an admin (enforced inside the function, not just RLS,
-- since this changes OTHER users' trust scores which no RLS policy
-- should allow directly).
-- ============================================================================

create function public.resolve_report(
  p_report_id uuid,
  p_is_valid boolean,
  p_penalty smallint default 0
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_report reports%rowtype;
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can resolve reports';
  end if;

  select * into v_report from public.reports where id = p_report_id;
  if v_report.id is null then
    raise exception 'Report not found';
  end if;
  if v_report.status <> 'pending' then
    raise exception 'Report already resolved';
  end if;

  if p_is_valid then
    if v_report.target_user_id is not null then
      perform public.adjust_trust_score(
        v_report.target_user_id,
        -greatest(0, least(100, p_penalty)),
        'Report upheld against this user',
        p_report_id
      );
    end if;
    perform public.adjust_trust_score(
      v_report.reporter_id,
      2,
      'Reward for a valid report',
      p_report_id
    );
    update public.reports
      set status = 'valid', trust_penalty = p_penalty,
          reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_report_id;
  else
    perform public.adjust_trust_score(
      v_report.reporter_id,
      -3,
      'Penalty for an invalid report',
      p_report_id
    );
    update public.reports
      set status = 'invalid', trust_penalty = 0,
          reviewed_by = auth.uid(), reviewed_at = now()
      where id = p_report_id;
  end if;
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.reports enable row level security;
alter table public.trust_score_logs enable row level security;

-- reports: a user can read reports they filed; admins can read everything.
create policy "users can read their own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

create policy "admins can read all reports"
  on public.reports for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "logged in users can file a report"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

-- No UPDATE policy is granted to anyone — reports are only ever resolved
-- through the resolve_report() function above (security definer), which
-- enforces the admin check itself. This prevents a non-admin from editing
-- report status directly via the table.

-- trust_score_logs: a user can see their own history; admins see everyone's.
create policy "users can read their own trust score logs"
  on public.trust_score_logs for select
  using (auth.uid() = user_id);

create policy "admins can read all trust score logs"
  on public.trust_score_logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- No INSERT/UPDATE/DELETE policies — rows are only ever written by the
-- adjust_trust_score() function (security definer).
