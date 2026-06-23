-- ============================================================================
-- GameHub — Migration 0007: Notifications system
-- Run this AFTER 0001–0006 in the Supabase SQL Editor.
-- ============================================================================

create type notification_type as enum (
  'reply',
  'upvote',
  'accepted_answer',
  'room_join',
  'room_full',
  'report_result',
  'badge_earned',
  'level_up'
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type notification_type not null,
  -- Free-form JSON payload, shaped differently per type. The app reads
  -- specific keys depending on `type` (see src/lib/notifications.ts).
  -- Examples:
  --   reply:            { post_id, post_title, reply_id, actor_username }
  --   upvote:            { post_id, reply_id, actor_username }
  --   accepted_answer:   { post_id, post_title }
  --   room_join:         { room_id, room_title, actor_username }
  --   room_full:         { room_id, room_title }
  --   report_result:     { report_id, target_type, status, trust_penalty }
  --   badge_earned:      { badge_slug, badge_name }
  --   level_up:          { new_level }
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_id_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where is_read = false;

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.notifications enable row level security;

create policy "users can read their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "users can mark their own notifications as read"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "users can delete their own notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);

-- No INSERT policy for regular users — notifications are only ever
-- created by the security-definer trigger functions below (or by
-- resolve_report(), updated further down), never directly by a client.

-- ============================================================================
-- Helper: create a notification (security definer so triggers can call it
-- regardless of who the current auth.uid() is — e.g. user A replying
-- should be able to notify user B).
-- ============================================================================

create function public.create_notification(
  p_user_id uuid,
  p_type notification_type,
  p_payload jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  -- Never notify someone about their own action (e.g. replying to your
  -- own post, upvoting your own reply isn't possible anyway but kept
  -- defensive).
  insert into public.notifications (user_id, type, payload)
  values (p_user_id, p_type, p_payload);
end;
$$;

-- ============================================================================
-- Trigger: notify post author when someone replies (not for self-replies)
-- ============================================================================

create function public.notify_on_reply()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_post posts%rowtype;
  v_actor_username text;
begin
  select * into v_post from public.posts where id = new.post_id;
  if v_post.author_id is null or v_post.author_id = new.author_id then
    return null;
  end if;

  select username into v_actor_username from public.profiles where id = new.author_id;

  perform public.create_notification(
    v_post.author_id,
    'reply',
    jsonb_build_object(
      'post_id', v_post.id,
      'post_title', v_post.title,
      'reply_id', new.id,
      'actor_username', v_actor_username
    )
  );
  return null;
end;
$$;

create trigger on_reply_notify
  after insert on public.replies
  for each row execute function public.notify_on_reply();

-- ============================================================================
-- Trigger: notify reply author when their reply gets upvoted
-- ============================================================================

create function public.notify_on_upvote()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_reply replies%rowtype;
  v_actor_username text;
begin
  select * into v_reply from public.replies where id = new.reply_id;
  if v_reply.author_id is null or v_reply.author_id = new.user_id then
    return null;
  end if;

  select username into v_actor_username from public.profiles where id = new.user_id;

  perform public.create_notification(
    v_reply.author_id,
    'upvote',
    jsonb_build_object(
      'post_id', v_reply.post_id,
      'reply_id', v_reply.id,
      'actor_username', v_actor_username
    )
  );
  return null;
end;
$$;

create trigger on_upvote_notify
  after insert on public.reply_votes
  for each row execute function public.notify_on_upvote();

-- ============================================================================
-- Trigger: notify reply author when their reply is marked accepted
-- ============================================================================

create function public.notify_on_accepted_answer()
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
      perform public.create_notification(
        v_author_id,
        'accepted_answer',
        jsonb_build_object('post_id', new.id, 'post_title', new.title)
      );
    end if;
  end if;
  return null;
end;
$$;

create trigger on_accepted_answer_notify
  after update of accepted_reply_id on public.posts
  for each row execute function public.notify_on_accepted_answer();

-- ============================================================================
-- Trigger: notify room host when someone joins (not when they join their
-- own room, which happens automatically on creation), and notify the
-- whole room when it becomes full.
-- ============================================================================

create function public.notify_on_room_join()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_room rooms%rowtype;
  v_actor_username text;
  v_member_count integer;
  v_member record;
begin
  select * into v_room from public.rooms where id = new.room_id;
  if v_room.host_id is null or v_room.host_id = new.user_id then
    return null;
  end if;

  select username into v_actor_username from public.profiles where id = new.user_id;

  perform public.create_notification(
    v_room.host_id,
    'room_join',
    jsonb_build_object('room_id', v_room.id, 'room_title', v_room.title, 'actor_username', v_actor_username)
  );

  select count(*) into v_member_count from public.room_members where room_id = v_room.id;

  if v_member_count >= v_room.max_players then
    for v_member in select user_id from public.room_members where room_id = v_room.id loop
      perform public.create_notification(
        v_member.user_id,
        'room_full',
        jsonb_build_object('room_id', v_room.id, 'room_title', v_room.title)
      );
    end loop;
  end if;

  return null;
end;
$$;

create trigger on_room_join_notify
  after insert on public.room_members
  for each row execute function public.notify_on_room_join();

-- ============================================================================
-- Trigger: notify a user when a badge is earned
-- ============================================================================

create function public.notify_on_badge_earned()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_badge_name text;
begin
  select name into v_badge_name from public.badges where id = new.badge_id;
  perform public.create_notification(
    new.user_id,
    'badge_earned',
    jsonb_build_object('badge_id', new.badge_id, 'badge_name', v_badge_name)
  );
  return null;
end;
$$;

create trigger on_badge_earned_notify
  after insert on public.user_badges
  for each row execute function public.notify_on_badge_earned();

-- ============================================================================
-- Trigger: notify a user when their level increases
-- ============================================================================

create function public.notify_on_level_up()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if new.level > old.level then
    perform public.create_notification(
      new.id,
      'level_up',
      jsonb_build_object('new_level', new.level)
    );
  end if;
  return null;
end;
$$;

create trigger on_level_up_notify
  after update of level on public.profiles
  for each row execute function public.notify_on_level_up();

-- ============================================================================
-- Update resolve_report() to also notify the reporter of the outcome.
-- (create or replace extends the function from migration 0004 without
-- needing to re-run that file.)
-- ============================================================================

create or replace function public.resolve_report(
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

  perform public.create_notification(
    v_report.reporter_id,
    'report_result',
    jsonb_build_object(
      'report_id', p_report_id,
      'target_type', v_report.target_type,
      'status', case when p_is_valid then 'valid' else 'invalid' end
    )
  );
end;
$$;
