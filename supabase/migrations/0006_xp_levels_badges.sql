-- ============================================================================
-- GameHub — Migration 0006: XP, Levels, and Badges
-- Run this AFTER 0001–0005 in the Supabase SQL Editor.
-- ============================================================================

-- ============================================================================
-- XP rules (constants, kept here as comments since Postgres has no global
-- config table pattern that's simpler than just hardcoding in the
-- functions below):
--   +5 XP   reply posted
--   +2 XP   reply receives an upvote (per upvote)
--   +15 XP  reply marked as the accepted answer
--   +3 XP   post published
-- Level formula: level = floor(sqrt(xp / 50)) + 1
--   This gives a smooth, increasingly-demanding curve:
--   level 1: 0 XP, level 2: 50 XP, level 3: 200 XP, level 4: 450 XP,
--   level 5: 800 XP, level 6: 1250 XP, level 10: 4050 XP, etc.
-- ============================================================================

create function public.xp_to_level(p_xp integer)
returns integer
language sql
immutable
as $$
  select floor(sqrt(greatest(p_xp, 0)::numeric / 50)) :: integer + 1;
$$;

create function public.xp_for_level(p_level integer)
returns integer
language sql
immutable
as $$
  select (power(greatest(p_level, 1) - 1, 2) * 50)::integer;
$$;

-- ============================================================================
-- Function: grant XP to a user and recompute their level. Used by all the
-- triggers below — never call this from the client; it's only invoked
-- internally by security-definer triggers, so no RLS/grant is needed on
-- it directly (it runs as the table owner regardless of caller).
-- ============================================================================

create function public.grant_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_xp integer;
begin
  update public.profiles
  set xp = xp + p_amount
  where id = p_user_id
  returning xp into v_new_xp;

  update public.profiles
  set level = public.xp_to_level(v_new_xp)
  where id = p_user_id;
end;
$$;

-- ============================================================================
-- Badges -------------------------------------------------------------------
-- ============================================================================

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null,
  icon text not null -- a lucide-react icon name, rendered in the app
);

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge_id uuid not null references public.badges (id) on delete cascade,
  earned_at timestamptz not null default now(),
  primary key (user_id, badge_id)
);

insert into public.badges (slug, name, description, icon) values
  ('helpful_solver', 'حل‌کننده مفید', 'به ۱۰ پاسخ شما رای مثبت داده شده یا بهترین پاسخ انتخاب شده', 'Lightbulb'),
  ('trusted_teammate', 'هم‌تیمی قابل‌اعتماد', 'امتیاز اعتماد شما به ۸۰ یا بالاتر رسیده', 'ShieldCheck'),
  ('active_member', 'عضو فعال', 'حداقل ۲۵ پست یا پاسخ در پلتفرم ثبت کرده‌اید', 'Flame'),
  ('veteran_user', 'کاربر باسابقه', 'بیش از ۳۰ روز از عضویت شما در گیم‌هاب می‌گذرد', 'Award');

-- ============================================================================
-- Function: award a badge to a user if they don't already have it, and
-- log a trust_score-style notification-worthy event (handled later by the
-- notifications system — for now this just inserts the badge silently).
-- ============================================================================

create function public.award_badge_if_missing(p_user_id uuid, p_badge_slug text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_badge_id uuid;
begin
  select id into v_badge_id from public.badges where slug = p_badge_slug;
  if v_badge_id is null then
    return;
  end if;

  insert into public.user_badges (user_id, badge_id)
  values (p_user_id, v_badge_id)
  on conflict (user_id, badge_id) do nothing;
end;
$$;

-- ============================================================================
-- Function: re-check all badge conditions for a user. Called after the
-- events that could plausibly change eligibility (new reply, new upvote,
-- accepted answer, trust score change). Cheap enough to run on every
-- relevant event given expected table sizes.
-- ============================================================================

create function public.recheck_badges(p_user_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_helpful_count integer;
  v_trust_score integer;
  v_contribution_count integer;
  v_created_at timestamptz;
begin
  -- helpful_solver: 10+ replies that are either upvoted at least once or
  -- are the accepted answer to their post.
  select count(*) into v_helpful_count
  from public.replies r
  where r.author_id = p_user_id
    and (
      r.upvote_count > 0
      or exists (
        select 1 from public.posts p
        where p.accepted_reply_id = r.id
      )
    );

  if v_helpful_count >= 10 then
    perform public.award_badge_if_missing(p_user_id, 'helpful_solver');
  end if;

  -- trusted_teammate: trust_score >= 80
  select trust_score, created_at into v_trust_score, v_created_at
  from public.profiles where id = p_user_id;

  if v_trust_score >= 80 then
    perform public.award_badge_if_missing(p_user_id, 'trusted_teammate');
  end if;

  -- active_member: 25+ posts or replies combined
  select
    (select count(*) from public.posts where author_id = p_user_id)
    + (select count(*) from public.replies where author_id = p_user_id)
  into v_contribution_count;

  if v_contribution_count >= 25 then
    perform public.award_badge_if_missing(p_user_id, 'active_member');
  end if;

  -- veteran_user: account older than 30 days
  if v_created_at < now() - interval '30 days' then
    perform public.award_badge_if_missing(p_user_id, 'veteran_user');
  end if;
end;
$$;

-- ============================================================================
-- Triggers: hook XP + badge rechecks into the existing forum/trust events
-- ============================================================================

create function public.handle_post_xp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.grant_xp(new.author_id, 3);
  perform public.recheck_badges(new.author_id);
  return null;
end;
$$;

create trigger on_post_insert_xp
  after insert on public.posts
  for each row execute function public.handle_post_xp();

create function public.handle_reply_xp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform public.grant_xp(new.author_id, 5);
  perform public.recheck_badges(new.author_id);
  return null;
end;
$$;

create trigger on_reply_insert_xp
  after insert on public.replies
  for each row execute function public.handle_reply_xp();

create function public.handle_reply_vote_xp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_author_id uuid;
begin
  select author_id into v_author_id from public.replies where id = new.reply_id;
  if v_author_id is not null then
    perform public.grant_xp(v_author_id, 2);
    perform public.recheck_badges(v_author_id);
  end if;
  return null;
end;
$$;

create trigger on_reply_vote_xp
  after insert on public.reply_votes
  for each row execute function public.handle_reply_vote_xp();

-- Accepted answer: fires when posts.accepted_reply_id changes from null
-- to a value (award), and handles unsetting gracefully (no XP removal,
-- to keep things simple and avoid punishing someone for an admin/author
-- changing their mind later).
create function public.handle_accepted_reply_xp()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_author_id uuid;
begin
  if new.accepted_reply_id is not null
     and (old.accepted_reply_id is null or old.accepted_reply_id <> new.accepted_reply_id) then
    select author_id into v_author_id from public.replies where id = new.accepted_reply_id;
    if v_author_id is not null then
      perform public.grant_xp(v_author_id, 15);
      perform public.recheck_badges(v_author_id);
    end if;
  end if;
  return null;
end;
$$;

create trigger on_accepted_reply_xp
  after update of accepted_reply_id on public.posts
  for each row execute function public.handle_accepted_reply_xp();

-- Trust score changes can also unlock the trusted_teammate badge —
-- recheck whenever adjust_trust_score() runs. Implemented by having
-- adjust_trust_score call recheck_badges directly (see below) rather
-- than a trigger on trust_score_logs, since trust_score_logs rows are
-- pure history and don't reflect the *current* score by themselves.

create or replace function public.adjust_trust_score(
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

  perform public.recheck_badges(p_user_id);
end;
$$;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.badges enable row level security;
alter table public.user_badges enable row level security;

create policy "badges are publicly readable"
  on public.badges for select
  using (true);

create policy "user badges are publicly readable"
  on public.user_badges for select
  using (true);

-- No INSERT/UPDATE/DELETE policies on either table for regular users —
-- badges are seeded once by an admin via SQL, and user_badges rows are
-- only ever written by award_badge_if_missing() (security definer).
