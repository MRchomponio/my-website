-- ============================================================================
-- GameHub — Migration 0010: Security audit fixes
-- Run this AFTER 0001–0009 in the Supabase SQL Editor.
--
-- This migration closes several privilege-escalation gaps found during a
-- full security review. PostgreSQL Row Level Security operates at the
-- ROW level — a `using (auth.uid() = id)` policy lets a user update ANY
-- column of their own row, not just the "safe" ones the UI exposes. The
-- application code never sent malicious updates, but nothing stopped a
-- crafted direct API request from doing so. Each fix below uses a
-- BEFORE UPDATE trigger to silently re-pin protected columns to their
-- existing (old) value whenever a non-privileged user attempts to
-- change them — this is the standard Postgres pattern for column-level
-- write protection, since RLS itself has no column granularity.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FIX 1: profiles — a user could set is_admin=true, or directly inflate
-- their own trust_score / xp / level, via a raw UPDATE request bypassing
-- the UI entirely. Protect every column that isn't meant to be
-- self-editable.
-- ----------------------------------------------------------------------------

create function public.protect_profile_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();

  if not coalesce(v_caller_is_admin, false) then
    new.is_admin := old.is_admin;
    new.trust_score := old.trust_score;
    new.xp := old.xp;
    new.level := old.level;
  end if;

  -- created_at must never change, even for admins.
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger protect_profile_columns_trigger
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ----------------------------------------------------------------------------
-- FIX 2: replies — a user could directly set upvote_count on their own
-- reply to any number, without real votes. This column must only ever
-- change via the on_reply_vote_change trigger (migration 0003).
-- ----------------------------------------------------------------------------

create function public.protect_reply_columns()
returns trigger
language plpgsql
as $$
begin
  new.upvote_count := old.upvote_count;
  new.post_id := old.post_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  return new;
end;
$$;

create trigger protect_reply_columns_trigger
  before update on public.replies
  for each row execute function public.protect_reply_columns();

-- ----------------------------------------------------------------------------
-- FIX 3: posts — the author's UPDATE policy lets them change is_pinned,
-- accepted_reply_id, view_count, reply_count, and game_id, none of which
-- should be author-editable through a raw request (is_pinned is
-- admin-only by product design; accepted_reply_id has its own button but
-- must be validated as actually belonging to this post; view_count and
-- reply_count are maintained by triggers; game_id must never move a post
-- to a different game after creation).
-- ----------------------------------------------------------------------------

create function public.protect_post_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();

  -- is_pinned: admin-only, regardless of who else is updating the row.
  if not coalesce(v_caller_is_admin, false) then
    new.is_pinned := old.is_pinned;
  end if;

  -- accepted_reply_id: only the post's own author may set this (enforced
  -- by the existing "author can update their own post" RLS policy
  -- already requiring auth.uid() = author_id), but additionally it must
  -- reference a reply that actually belongs to THIS post — otherwise a
  -- post author could falsely "accept" an unrelated reply from another
  -- post to manipulate someone else's XP.
  if new.accepted_reply_id is not null
     and new.accepted_reply_id is distinct from old.accepted_reply_id then
    if not exists (
      select 1 from public.replies
      where id = new.accepted_reply_id and post_id = new.id
    ) then
      raise exception 'accepted_reply_id must reference a reply on this post';
    end if;
  end if;

  new.view_count := old.view_count;
  new.reply_count := old.reply_count;
  new.game_id := old.game_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;

  return new;
end;
$$;

create trigger protect_post_columns_trigger
  before update on public.posts
  for each row execute function public.protect_post_columns();

-- View count still needs a writable path for the post detail page
-- (src/app/posts/[postId]/page.tsx) which increments it via the admin
-- client (service role) — that path bypasses RLS and triggers fire as
-- the table owner regardless, so the OLD value reassignment above does
-- NOT affect the admin client's own UPDATE. Regular users simply lose
-- the ability to set it themselves, which is the intended fix.

-- ----------------------------------------------------------------------------
-- FIX 4: rooms — the host could change host_id (transferring/stealing
-- ownership semantics), status (e.g. forcing it to stay 'open' after
-- being full, bypassing the auto-close trigger), game_id, or max_players
-- after members have already joined expecting a certain size.
-- ----------------------------------------------------------------------------

create function public.protect_room_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();

  new.host_id := old.host_id;
  new.game_id := old.game_id;
  new.created_at := old.created_at;

  -- status is fully trigger-managed (open/full) except for admins, who
  -- may force-close via admin_close_room() (security definer, migration
  -- 0005) — that function runs as table owner so it is unaffected by
  -- this reassignment regardless of the caller's admin flag here.
  if not coalesce(v_caller_is_admin, false) then
    new.status := old.status;
  end if;

  return new;
end;
$$;

create trigger protect_room_columns_trigger
  before update on public.rooms
  for each row execute function public.protect_room_columns();

-- ----------------------------------------------------------------------------
-- FIX 5: room_messages had no DELETE policy at all, meaning neither the
-- message author nor an admin could remove an abusive message through
-- the app. Add narrow delete rights for both.
-- ----------------------------------------------------------------------------

create policy "author or admin can delete a room message"
  on public.room_messages for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ----------------------------------------------------------------------------
-- FIX 6: storage buckets had no server-side file size / MIME type
-- enforcement — the 4MB limit and allowed image types in
-- ImageUploader.tsx were client-side only and trivially bypassable with
-- a direct API request. Enforce the same limits at the bucket level,
-- which Supabase Storage checks before accepting an upload regardless
-- of what the client claims.
-- ----------------------------------------------------------------------------

update storage.buckets
set file_size_limit = 4194304, -- 4MB, matches ImageUploader.tsx
    allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id in ('game-assets', 'room-banners');

-- ----------------------------------------------------------------------------
-- FIX 7: basic rate limiting on sensitive write paths (reports, posts,
-- replies, room_messages). True distributed rate limiting belongs in an
-- edge/middleware layer, but a database-level floor prevents the most
-- obvious abuse (e.g. a compromised or scripted account spamming
-- hundreds of reports/posts per second) even if that layer is
-- missing or misconfigured. Each check is intentionally generous
-- (it should never trigger for a real human) so it only catches
-- automated abuse, not normal fast typing.
-- ----------------------------------------------------------------------------

create function public.enforce_rate_limit(
  p_table_name text,
  p_user_id uuid,
  p_window_seconds integer,
  p_max_count integer
)
returns void
language plpgsql
as $$
declare
  v_count integer;
begin
  execute format(
    'select count(*) from public.%I where author_id = $1 and created_at > now() - interval ''%s seconds''',
    p_table_name, p_window_seconds
  ) into v_count using p_user_id;

  if v_count >= p_max_count then
    raise exception 'Rate limit exceeded: too many % in a short time. Please slow down.', p_table_name;
  end if;
end;
$$;

create function public.rate_limit_posts()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_rate_limit('posts', new.author_id, 60, 5);
  return new;
end;
$$;

create trigger rate_limit_posts_trigger
  before insert on public.posts
  for each row execute function public.rate_limit_posts();

create function public.rate_limit_replies()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_rate_limit('replies', new.author_id, 60, 10);
  return new;
end;
$$;

create trigger rate_limit_replies_trigger
  before insert on public.replies
  for each row execute function public.rate_limit_replies();

-- reports has a `reporter_id` column, not `author_id` — handled with its
-- own dedicated function rather than reusing enforce_rate_limit()'s
-- hardcoded column name.
create function public.rate_limit_reports()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.reports
  where reporter_id = new.reporter_id
    and created_at > now() - interval '300 seconds';

  if v_count >= 10 then
    raise exception 'Rate limit exceeded: too many reports in a short time. Please slow down.';
  end if;

  return new;
end;
$$;

create trigger rate_limit_reports_trigger
  before insert on public.reports
  for each row execute function public.rate_limit_reports();

-- room_messages also uses author_id, so it can reuse enforce_rate_limit().
create function public.rate_limit_room_messages()
returns trigger
language plpgsql
as $$
begin
  perform public.enforce_rate_limit('room_messages', new.author_id, 10, 8);
  return new;
end;
$$;

create trigger rate_limit_room_messages_trigger
  before insert on public.room_messages
  for each row execute function public.rate_limit_room_messages();
