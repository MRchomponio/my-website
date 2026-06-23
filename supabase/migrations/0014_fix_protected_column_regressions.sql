-- ============================================================================
-- GameHub — Migration 0014: Fix protected-column triggers silently
-- blocking legitimate system writes (regression introduced by 0010)
-- Run this AFTER 0001–0013 in the Supabase SQL Editor.
--
-- ROOT CAUSE: migration 0010 added BEFORE UPDATE triggers on profiles,
-- replies, posts, and rooms to stop a user from directly setting
-- protected columns (xp, upvote_count, view_count, room status, etc.)
-- via a raw API request. Those triggers fire for EVERY UPDATE on the
-- table, no matter which role or function issued it — a fact that two
-- of 0010's own comments got wrong, claiming "security definer" or "the
-- admin/service-role client" would bypass them. Neither does:
-- SECURITY DEFINER only changes which role's PERMISSIONS apply to the
-- function body, and the Supabase service-role key only bypasses ROW
-- LEVEL SECURITY — neither one disables triggers. Triggers always fire
-- regardless of caller role unless explicitly disabled.
--
-- PRACTICAL IMPACT: since 0010 shipped, every one of these has been
-- silently broken (no errors anywhere — the triggers were doing exactly
-- their designed job of reverting unauthorized changes, just applied
-- too broadly):
--   • profiles.xp / profiles.level never increase (grant_xp, 0006)
--   • replies.upvote_count never changes (handle_reply_vote_change, 0003)
--   • posts.reply_count never changes (handle_reply_change, 0003)
--   • posts.view_count never increases (broken raw update in app code)
--   • rooms.status never auto-flips to 'full'/'open' (handle_room_member_change, 0002)
--
-- FIX: a transaction-local session flag (`gamehub.trusted_write`) that
-- ONLY the app's own internal SECURITY DEFINER functions set, briefly,
-- right before their own UPDATE — signaling "this specific write is
-- trusted server-side logic, not a raw client request". A malicious
-- client cannot set this flag itself: set_config() is a Postgres
-- builtin in pg_catalog, never exposed through Supabase's PostgREST
-- /rpc/ endpoint (which only exposes functions explicitly defined in
-- the public schema), and nothing in this schema wraps it for client
-- use. The flag is transaction-local (set_config's third argument
-- `true`), so it can never leak into an unrelated later request even if
-- a function forgot to turn it back off.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- profiles: xp/level now also accept a trusted write. is_admin and
-- trust_score deliberately do NOT get this bypass — granting admin or
-- changing trust score should only ever happen via an actual admin
-- caller (is_admin) or through adjust_trust_score()'s own explicit
-- admin check upstream, never through a generic "trusted" flag that a
-- future unrelated function might set.
-- ----------------------------------------------------------------------------

create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
  v_trusted boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();
  v_trusted := coalesce(current_setting('gamehub.trusted_write', true), '') = 'on';

  -- is_admin: NEVER gets a v_trusted bypass, on purpose — granting or
  -- revoking admin status must always go through an actual admin
  -- caller, never an automated "trusted internal write" path.
  if not coalesce(v_caller_is_admin, false) then
    new.is_admin := old.is_admin;
  end if;

  -- trust_score: written by adjust_trust_score() below, whose only
  -- current caller (resolve_report) is itself admin-gated — but also
  -- accepts v_trusted so a future caller outside an admin context
  -- (e.g. an automatic trust adjustment from a Marketplace transaction)
  -- doesn't silently hit this exact bug class again.
  --
  -- xp/level: written exclusively by grant_xp() below, called from
  -- AFTER triggers fired by ordinary users' own posts/replies/votes/
  -- accepted answers — auth.uid() there is that ordinary user, never an
  -- admin, so the is_admin check could never be the gate for these.
  if not coalesce(v_caller_is_admin, false) and not v_trusted then
    new.trust_score := old.trust_score;
    new.xp := old.xp;
    new.level := old.level;
  end if;

  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function public.grant_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_new_xp integer;
begin
  perform set_config('gamehub.trusted_write', 'on', true);

  update public.profiles
  set xp = xp + p_amount
  where id = p_user_id
  returning xp into v_new_xp;

  update public.profiles
  set level = public.xp_to_level(v_new_xp)
  where id = p_user_id;

  perform set_config('gamehub.trusted_write', 'off', true);
end;
$$;

-- adjust_trust_score's only caller (resolve_report) is already
-- admin-gated, so setting the flag here isn't strictly required today
-- — added anyway for defense-in-depth so a future caller outside an
-- admin context doesn't silently reintroduce this exact bug class.
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
  perform set_config('gamehub.trusted_write', 'on', true);

  update public.profiles
  set trust_score = greatest(0, least(100, trust_score + p_delta))
  where id = p_user_id;

  insert into public.trust_score_logs (user_id, delta, reason, related_report_id)
  values (p_user_id, p_delta, p_reason, p_related_report_id);

  perform public.recheck_badges(p_user_id);

  perform set_config('gamehub.trusted_write', 'off', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- replies: upvote_count now accepts a trusted write from
-- handle_reply_vote_change() below, triggered whenever ANY user (not
-- just admins) casts or removes an upvote.
-- ----------------------------------------------------------------------------

create or replace function public.protect_reply_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_trusted boolean;
begin
  v_trusted := coalesce(current_setting('gamehub.trusted_write', true), '') = 'on';

  if not v_trusted then
    new.upvote_count := old.upvote_count;
  end if;

  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create or replace function public.handle_reply_vote_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('gamehub.trusted_write', 'on', true);

  if (tg_op = 'INSERT') then
    update public.replies set upvote_count = upvote_count + 1 where id = new.reply_id;
  elsif (tg_op = 'DELETE') then
    update public.replies set upvote_count = greatest(upvote_count - 1, 0) where id = old.reply_id;
  end if;

  perform set_config('gamehub.trusted_write', 'off', true);
  return null;
end;
$$;

-- ----------------------------------------------------------------------------
-- posts: reply_count and view_count now accept a trusted write.
-- reply_count comes from handle_reply_change() below (ordinary users
-- posting/deleting replies). view_count gets a dedicated RPC,
-- increment_post_view_count(), replacing the broken raw service-role
-- .update() call that used to run from the post detail page — that
-- call never actually worked, for the reason explained at the top of
-- this file.
-- ----------------------------------------------------------------------------

create or replace function public.protect_post_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
  v_trusted boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();
  v_trusted := coalesce(current_setting('gamehub.trusted_write', true), '') = 'on';

  if not coalesce(v_caller_is_admin, false) then
    new.is_pinned := old.is_pinned;
  end if;

  if new.accepted_reply_id is not null
     and new.accepted_reply_id is distinct from old.accepted_reply_id then
    if not exists (
      select 1 from public.replies
      where id = new.accepted_reply_id and post_id = new.id
    ) then
      raise exception 'accepted_reply_id must reference a reply on this post';
    end if;
  end if;

  if not v_trusted then
    new.view_count := old.view_count;
    new.reply_count := old.reply_count;
  end if;

  new.game_id := old.game_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

create or replace function public.handle_reply_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('gamehub.trusted_write', 'on', true);

  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.post_id;
  end if;

  perform set_config('gamehub.trusted_write', 'off', true);
  return null;
end;
$$;

-- New: dedicated RPC for view counting. SECURITY DEFINER and callable
-- with no auth requirement, on purpose — a post's view count should
-- increment even for a logged-out visitor, matching the page's original
-- (previously broken) intent. No new anti-spam/rate-limiting is added
-- here since the original design had none either — out of scope for a
-- bug fix.
create function public.increment_post_view_count(p_post_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  perform set_config('gamehub.trusted_write', 'on', true);
  update public.posts set view_count = view_count + 1 where id = p_post_id;
  perform set_config('gamehub.trusted_write', 'off', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- rooms: status now accepts a trusted write from
-- handle_room_member_change() below (migration 0002), which auto-flips
-- a room between 'open' and 'full' as ordinary users join/leave —
-- something an admin is essentially never the one triggering.
-- admin_close_room() (migration 0005) keeps working exactly as before
-- through the existing is_admin branch, since closing a room IS always
-- an actual admin caller.
-- ----------------------------------------------------------------------------

create or replace function public.protect_room_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
  v_trusted boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();
  v_trusted := coalesce(current_setting('gamehub.trusted_write', true), '') = 'on';

  new.host_id := old.host_id;
  new.game_id := old.game_id;
  new.created_at := old.created_at;

  if not coalesce(v_caller_is_admin, false) and not v_trusted then
    new.status := old.status;
  end if;

  return new;
end;
$$;

create or replace function public.handle_room_member_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_count integer;
begin
  select * into v_room from public.rooms
    where id = coalesce(new.room_id, old.room_id);

  select count(*) into v_count from public.room_members
    where room_id = v_room.id;

  perform set_config('gamehub.trusted_write', 'on', true);

  if v_count >= v_room.max_players then
    update public.rooms set status = 'full' where id = v_room.id;
  elsif v_room.status = 'full' then
    update public.rooms set status = 'open' where id = v_room.id;
  end if;

  perform set_config('gamehub.trusted_write', 'off', true);

  return null;
end;
$$;

-- ============================================================================
-- PART 2 — Generalize wallets.balance_rials protection to the same
-- gamehub.trusted_write flag, replacing the is_admin-only check from
-- migration 0013.
--
-- Why this can't stay is_admin-only: the upcoming Currency Shop /
-- account marketplace / item trading purchase flows all need a BUYER
-- (an ordinary, non-admin user) to debit their OWN wallet balance when
-- they complete a purchase — auth.uid() at that point is the buyer, not
-- an admin, so the is_admin-only check from 0013 would block every
-- purchase exactly the way it blocked profiles.xp before this same fix.
-- approve_wallet_topup() below is updated to set the flag explicitly
-- (it no longer relies on the trigger's is_admin check), and every
-- future Marketplace RPC that touches balance_rials must do the same.
-- ============================================================================

create or replace function public.protect_wallet_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_trusted boolean;
begin
  v_trusted := coalesce(current_setting('gamehub.trusted_write', true), '') = 'on';

  if not v_trusted then
    new.balance_rials := old.balance_rials;
  end if;

  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.approve_wallet_topup(p_request_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_request public.wallet_topup_requests;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can approve top-up requests';
  end if;

  select * into v_request
  from public.wallet_topup_requests
  where id = p_request_id
  for update; -- lock the row so a double-click can't double-credit

  if not found then
    raise exception 'Top-up request not found';
  end if;

  if v_request.status is distinct from 'pending' then
    raise exception 'This request has already been reviewed';
  end if;

  insert into public.wallets (user_id)
  values (v_request.user_id)
  on conflict (user_id) do nothing;

  perform set_config('gamehub.trusted_write', 'on', true);

  update public.wallets
  set balance_rials = balance_rials + v_request.amount_rials
  where user_id = v_request.user_id;

  perform set_config('gamehub.trusted_write', 'off', true);

  update public.wallet_topup_requests
  set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id;

  perform public.create_notification(
    v_request.user_id,
    'wallet_topup_result',
    jsonb_build_object('status', 'approved', 'amount_rials', v_request.amount_rials)
  );

  perform public.log_admin_action(
    'approve_wallet_topup', 'wallet_topup_request', p_request_id,
    jsonb_build_object('user_id', v_request.user_id, 'amount_rials', v_request.amount_rials)
  );
end;
$$;
