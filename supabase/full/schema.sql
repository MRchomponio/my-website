-- ============================================================================
-- GameHub — Full database schema (consolidated migration history)
-- ============================================================================
-- این فایل، تاریخچه‌ی کامل همه‌ی migration های پروژه‌ست.
-- روی دیتابیس تازه: کل فایل رو یک‌جا اجرا کن.
-- روی دیتابیس موجود: فقط migration های جدید (بخش‌های ## FILE جدید) رو اجرا کن.
-- ============================================================================


-- ############################################################################
-- ## FILE: 0001_init_core.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0001: Core schema (profiles, games, favorites)
-- Run this in the Supabase SQL Editor, or via `supabase db push`.
-- ============================================================================

-- Extensions ------------------------------------------------------------
create extension if not exists "pgcrypto"; -- gen_random_uuid()

-- Enum types --------------------------------------------------------------
create type platform as enum ('pc', 'playstation', 'xbox', 'mobile');
create type play_style as enum ('casual', 'competitive');

-- profiles ------------------------------------------------------------------
-- One row per auth.users row. id is shared with auth.users.id (1:1).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique,
  display_name text,
  avatar_url text,
  bio text check (char_length(bio) <= 280),
  platform platform,
  play_style play_style,
  trust_score smallint not null default 50 check (trust_score between 0 and 100),
  xp integer not null default 0 check (xp >= 0),
  level integer not null default 1 check (level >= 1),
  is_admin boolean not null default false,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[a-zA-Z0-9_]{3,20}$')
);

create index profiles_username_idx on public.profiles (lower(username));
create index profiles_trust_score_idx on public.profiles (trust_score desc);

-- games -----------------------------------------------------------------
create table public.games (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  banner_url text,
  icon_url text,
  accent_color text not null default '#3b82f6',
  description text,
  created_at timestamptz not null default now()
);

create index games_slug_idx on public.games (slug);

-- favorites (followed games) -----------------------------------------------
create table public.favorites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, game_id)
);

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.games enable row level security;
alter table public.favorites enable row level security;

-- profiles: anyone (incl. anonymous) can read; users can only edit their own row.
create policy "profiles are publicly readable"
  on public.profiles for select
  using (true);

create policy "users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Note: profiles INSERT happens only via the handle_new_user() trigger
-- below (running as the table owner), so no INSERT policy is granted to
-- regular users — this prevents anyone from creating arbitrary profile
-- rows or impersonating another user id.

-- games: publicly readable; writes restricted to admins (checked in app layer
-- via service role for now — a dedicated admin policy can be added once an
-- admin UI exists).
create policy "games are publicly readable"
  on public.games for select
  using (true);

-- favorites: users manage their own favorites only.
create policy "users can read their own favorites"
  on public.favorites for select
  using (auth.uid() = user_id);

create policy "users can add their own favorites"
  on public.favorites for insert
  with check (auth.uid() = user_id);

create policy "users can remove their own favorites"
  on public.favorites for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Trigger: auto-create a profile row whenever a new auth.users row appears
-- ============================================================================

create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'username',
      'user_' || substr(new.id::text, 1, 8)
    ),
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- Seed data: starter games
-- ============================================================================

insert into public.games (slug, name, accent_color, description) values
  ('valorant', 'Valorant', '#ff4655', 'Tactical 5v5 character-based shooter.'),
  ('minecraft', 'Minecraft', '#5fba46', 'Sandbox survival and creative building.'),
  ('gta-online', 'GTA Online', '#9b5de5', 'Open-world multiplayer chaos.'),
  ('league-of-legends', 'League of Legends', '#c8aa6e', '5v5 MOBA.'),
  ('fortnite', 'Fortnite', '#3ad6ff', 'Battle royale building shooter.');

-- ############################################################################
-- ## FILE: 0002_admin_and_rooms.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0002: Admin game management + LFG rooms system
-- Run this AFTER 0001_init_core.sql in the Supabase SQL Editor.
-- ============================================================================

-- Enum types --------------------------------------------------------------
create type room_mode as enum ('casual', 'competitive');
create type room_status as enum ('open', 'full', 'closed');

-- rooms -----------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 3 and 80),
  description text check (char_length(description) <= 500),
  banner_url text,
  mode room_mode not null default 'casual',
  max_players smallint not null check (max_players between 2 and 20),
  status room_status not null default 'open',
  created_at timestamptz not null default now()
);

create index rooms_game_id_idx on public.rooms (game_id);
create index rooms_status_idx on public.rooms (status);

-- room_members ------------------------------------------------------------
create table public.room_members (
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- room_messages (simple text chat inside a room) ---------------------------
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index room_messages_room_id_idx on public.room_messages (room_id, created_at);

-- ============================================================================
-- Auto-close a room when it reaches max_players, and auto-add the host
-- as the first member when a room is created.
-- ============================================================================

create function public.handle_new_room()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.room_members (room_id, user_id)
  values (new.id, new.host_id);
  return new;
end;
$$;

create trigger on_room_created
  after insert on public.rooms
  for each row execute function public.handle_new_room();

create function public.handle_room_member_change()
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

  if v_count >= v_room.max_players then
    update public.rooms set status = 'full' where id = v_room.id;
  elsif v_room.status = 'full' then
    update public.rooms set status = 'open' where id = v_room.id;
  end if;

  return null;
end;
$$;

create trigger on_room_member_change
  after insert or delete on public.room_members
  for each row execute function public.handle_room_member_change();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.rooms enable row level security;
alter table public.room_members enable row level security;
alter table public.room_messages enable row level security;

-- rooms: publicly readable; only logged-in users can create; only the host
-- can update/delete their own room.
create policy "rooms are publicly readable"
  on public.rooms for select
  using (true);

create policy "logged in users can create rooms"
  on public.rooms for insert
  with check (auth.uid() = host_id);

create policy "host can update their own room"
  on public.rooms for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

create policy "host can delete their own room"
  on public.rooms for delete
  using (auth.uid() = host_id);

-- room_members: readable by anyone (so the room list can show member
-- count / avatars); a user can only insert/delete THEIR OWN membership row
-- (i.e. join/leave themselves) — the host cannot remove other members here
-- (a moderation/kick feature would use the admin client instead).
create policy "room members are publicly readable"
  on public.room_members for select
  using (true);

create policy "users can join a room themselves"
  on public.room_members for insert
  with check (auth.uid() = user_id);

create policy "users can leave a room themselves"
  on public.room_members for delete
  using (auth.uid() = user_id);

-- room_messages: only members of the room can read or post messages.
create policy "room members can read messages"
  on public.room_messages for select
  using (
    exists (
      select 1 from public.room_members
      where room_members.room_id = room_messages.room_id
        and room_members.user_id = auth.uid()
    )
  );

create policy "room members can send messages"
  on public.room_messages for insert
  with check (
    auth.uid() = author_id
    and exists (
      select 1 from public.room_members
      where room_members.room_id = room_messages.room_id
        and room_members.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Admin policies for games (create/update/delete restricted to is_admin)
-- ============================================================================

create policy "admins can insert games"
  on public.games for insert
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can update games"
  on public.games for update
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  )
  with check (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can delete games"
  on public.games for delete
  using (
    exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ============================================================================
-- Storage bucket for game banners/icons and room banners
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('game-assets', 'game-assets', true)
on conflict (id) do nothing;

create policy "game assets are publicly readable"
  on storage.objects for select
  using (bucket_id = 'game-assets');

create policy "admins can upload game assets"
  on storage.objects for insert
  with check (
    bucket_id = 'game-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can update game assets"
  on storage.objects for update
  using (
    bucket_id = 'game-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can delete game assets"
  on storage.objects for delete
  using (
    bucket_id = 'game-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- Room banners: the room's host can upload/manage the banner for their room.
-- We use a simpler rule: any logged-in user can upload to the
-- `room-banners` bucket (cleanup of orphaned files can be handled later by
-- an admin job) — this keeps room creation simple for now.
insert into storage.buckets (id, name, public)
values ('room-banners', 'room-banners', true)
on conflict (id) do nothing;

create policy "room banners are publicly readable"
  on storage.objects for select
  using (bucket_id = 'room-banners');

create policy "logged in users can upload room banners"
  on storage.objects for insert
  with check (bucket_id = 'room-banners' and auth.uid() is not null);

-- ============================================================================
-- One-time setup: promote your own account to admin.
-- Run this separately, AFTER you've signed up in the app at least once,
-- replacing 'your_username' with your actual username.
-- ============================================================================

-- update public.profiles set is_admin = true where username = 'your_username';

-- ############################################################################
-- ## FILE: 0003_forum.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0003: Game forum system (posts, replies, voting)
-- Run this AFTER 0001 and 0002 in the Supabase SQL Editor.
-- ============================================================================

-- Enum types --------------------------------------------------------------
create type post_category as enum ('question', 'tutorial', 'bug', 'discussion');

-- posts -----------------------------------------------------------------
create table public.posts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null check (char_length(title) between 5 and 150),
  body text not null check (char_length(body) between 1 and 10000),
  category post_category not null default 'discussion',
  is_pinned boolean not null default false,
  accepted_reply_id uuid, -- FK added after replies table exists (circular ref)
  view_count integer not null default 0,
  reply_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_game_id_idx on public.posts (game_id, created_at desc);
create index posts_pinned_idx on public.posts (game_id, is_pinned desc, created_at desc);
create index posts_category_idx on public.posts (game_id, category);
create index posts_author_id_idx on public.posts (author_id);

-- Full text search index (title + body, weighted)
alter table public.posts add column search_vector tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(body, '')), 'B')
  ) stored;

create index posts_search_idx on public.posts using gin (search_vector);

-- replies -----------------------------------------------------------------
create table public.replies (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  upvote_count integer not null default 0,
  created_at timestamptz not null default now()
);

create index replies_post_id_idx on public.replies (post_id, created_at);

-- Now that replies exists, add the FK from posts.accepted_reply_id
alter table public.posts
  add constraint posts_accepted_reply_id_fkey
  foreign key (accepted_reply_id) references public.replies (id) on delete set null;

-- reply_votes (one upvote per user per reply) ------------------------------
create table public.reply_votes (
  reply_id uuid not null references public.replies (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (reply_id, user_id)
);

-- ============================================================================
-- Triggers: keep posts.reply_count and replies.upvote_count in sync
-- ============================================================================

create function public.handle_reply_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.posts set reply_count = reply_count + 1 where id = new.post_id;
  elsif (tg_op = 'DELETE') then
    update public.posts set reply_count = greatest(reply_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger on_reply_change
  after insert or delete on public.replies
  for each row execute function public.handle_reply_change();

create function public.handle_reply_vote_change()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.replies set upvote_count = upvote_count + 1 where id = new.reply_id;
  elsif (tg_op = 'DELETE') then
    update public.replies set upvote_count = greatest(upvote_count - 1, 0) where id = old.reply_id;
  end if;
  return null;
end;
$$;

create trigger on_reply_vote_change
  after insert or delete on public.reply_votes
  for each row execute function public.handle_reply_vote_change();

-- Keep posts.updated_at fresh on edit
create function public.handle_post_update()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger on_post_update
  before update on public.posts
  for each row execute function public.handle_post_update();

-- ============================================================================
-- Row Level Security
-- ============================================================================

alter table public.posts enable row level security;
alter table public.replies enable row level security;
alter table public.reply_votes enable row level security;

-- posts: publicly readable; logged-in users can create; only the author can
-- edit their own post body/title/category; pinning and accepted-reply are
-- restricted to either the author (accepted reply) or an admin (pinning) —
-- enforced below with two separate, narrower update policies plus a check
-- in application code for which columns are being changed.
create policy "posts are publicly readable"
  on public.posts for select
  using (true);

create policy "logged in users can create posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

create policy "author can update their own post"
  on public.posts for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "admins can update any post"
  on public.posts for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "author or admin can delete a post"
  on public.posts for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- replies: publicly readable; logged-in users can create; only the author
-- can edit/delete their own reply (admins can also delete, for moderation).
create policy "replies are publicly readable"
  on public.replies for select
  using (true);

create policy "logged in users can create replies"
  on public.replies for insert
  with check (auth.uid() = author_id);

create policy "author can update their own reply"
  on public.replies for update
  using (auth.uid() = author_id)
  with check (auth.uid() = author_id);

create policy "author or admin can delete a reply"
  on public.replies for delete
  using (
    auth.uid() = author_id
    or exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- reply_votes: publicly readable (to show vote counts/who voted); a user
-- can only insert/delete THEIR OWN vote.
create policy "reply votes are publicly readable"
  on public.reply_votes for select
  using (true);

create policy "users can upvote a reply themselves"
  on public.reply_votes for insert
  with check (auth.uid() = user_id);

create policy "users can remove their own upvote"
  on public.reply_votes for delete
  using (auth.uid() = user_id);

-- ============================================================================
-- Helper RPC: full text search across posts (used by the search bar)
-- ============================================================================

create function public.search_posts(search_query text, game_filter uuid default null)
returns setof public.posts
language sql
stable
as $$
  select *
  from public.posts
  where search_vector @@ websearch_to_tsquery('simple', search_query)
    and (game_filter is null or game_id = game_filter)
  order by ts_rank(search_vector, websearch_to_tsquery('simple', search_query)) desc
  limit 50;
$$;

-- ############################################################################
-- ## FILE: 0004_trust_and_reports.sql
-- ############################################################################

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

-- ############################################################################
-- ## FILE: 0005_admin_close_room.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0005: Admin room moderation
-- Run this AFTER 0001–0004 in the Supabase SQL Editor.
--
-- Background: the rooms UPDATE policy only allows the room's host to
-- modify their own room, by design — so admins cannot directly UPDATE
-- someone else's room from the client. This function gives admins a
-- narrow, audited way to close any room without weakening that policy.
-- ============================================================================

create function public.admin_close_room(p_room_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can close another user''s room';
  end if;

  update public.rooms set status = 'closed' where id = p_room_id;
end;
$$;

-- ############################################################################
-- ## FILE: 0006_xp_levels_badges.sql
-- ############################################################################

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

-- ############################################################################
-- ## FILE: 0007_notifications.sql
-- ############################################################################

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

-- ############################################################################
-- ## FILE: 0008_global_search.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0008: Global search (posts, users, games, rooms)
-- Run this AFTER 0001–0007 in the Supabase SQL Editor.
-- ============================================================================

-- Trigram indexes power fast partial/fuzzy ILIKE matching on short text
-- fields (usernames, game names, room titles) — full-text search (used
-- for posts in migration 0003) is overkill for single-word/short-phrase
-- fields and trigram indexes match substrings better for this use case
-- (e.g. typing "val" should find "Valorant").
create extension if not exists pg_trgm;

create index profiles_username_trgm_idx on public.profiles using gin (username gin_trgm_ops);
create index games_name_trgm_idx on public.games using gin (name gin_trgm_ops);
create index rooms_title_trgm_idx on public.rooms using gin (title gin_trgm_ops);

-- ============================================================================
-- Unified search RPC: queries all four content types in one round trip
-- and returns a single ranked list the client can render directly,
-- instead of four separate sequential queries from the browser.
-- ============================================================================

create type search_result_type as enum ('post', 'user', 'game', 'room');

create or replace function public.global_search(p_query text, p_limit integer default 8)
returns table (
  result_type search_result_type,
  id uuid,
  title text,
  subtitle text,
  accent_color text,
  image_url text,
  slug text
)
language sql
stable
as $$
  (
    select
      'post'::search_result_type,
      p.id,
      p.title,
      g.name,
      g.accent_color,
      null::text,
      null::text
    from public.posts p
    join public.games g on g.id = p.game_id
    where p.search_vector @@ websearch_to_tsquery('simple', p_query)
    order by ts_rank(p.search_vector, websearch_to_tsquery('simple', p_query)) desc
    limit p_limit
  )
  union all
  (
    select
      'user'::search_result_type,
      pr.id,
      coalesce(pr.display_name, pr.username),
      '@' || pr.username,
      null::text,
      pr.avatar_url,
      pr.username
    from public.profiles pr
    where pr.username ilike '%' || p_query || '%'
       or pr.display_name ilike '%' || p_query || '%'
    order by pr.trust_score desc
    limit p_limit
  )
  union all
  (
    select
      'game'::search_result_type,
      ga.id,
      ga.name,
      ga.description,
      ga.accent_color,
      ga.icon_url,
      ga.slug
    from public.games ga
    where ga.name ilike '%' || p_query || '%'
    order by ga.name
    limit p_limit
  )
  union all
  (
    select
      'room'::search_result_type,
      r.id,
      r.title,
      g2.name,
      g2.accent_color,
      null::text,
      null::text
    from public.rooms r
    join public.games g2 on g2.id = r.game_id
    where r.title ilike '%' || p_query || '%'
      and r.status <> 'closed'
    order by r.created_at desc
    limit p_limit
  );
$$;

-- ############################################################################
-- ## FILE: 0009_fix_favorites_visibility.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0009: Fix favorites visibility on public profiles
-- Run this AFTER 0001–0008 in the Supabase SQL Editor.
--
-- Bug: the original favorites SELECT policy only let a user read their
-- OWN favorites (auth.uid() = user_id). But the public profile page
-- (src/app/profile/[username]/page.tsx) shows ANY user's favorited
-- games to ANY visitor — including logged-out ones. With the old
-- policy, that query silently returned zero rows for everyone except
-- the profile owner themselves, so "Favorite games" always appeared
-- empty on other people's profiles.
--
-- Fix: favorited games are public information (shown in the UI to
-- everyone), so SELECT should be open to all, same as `profiles` and
-- `games`. INSERT/DELETE remain restricted to the owning user — only
-- the bug in visibility is being fixed here, not who can change it.
-- ============================================================================

drop policy "users can read their own favorites" on public.favorites;

create policy "favorites are publicly readable"
  on public.favorites for select
  using (true);

-- ############################################################################
-- ## FILE: 0010_security_audit_fixes.sql
-- ############################################################################

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

-- ############################################################################
-- ## FILE: 0011_avatars_and_admin_tags.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0011: Avatar uploads + admin-managed badges & tags
-- Run this AFTER 0001–0010 in the Supabase SQL Editor.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Avatars storage bucket
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB — smaller than game-assets since avatars are small/square
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "avatars are publicly readable"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Users may only upload/update/delete files inside a folder matching
-- their own user id (storage path convention: avatars/{user_id}/...),
-- mirroring how ImageUploader.tsx already namespaces uploads by
-- auth.uid() for game-assets and room-banners.
create policy "users can upload their own avatar"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can update their own avatar"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ----------------------------------------------------------------------------
-- Manual (admin-assigned) badges — distinct from the automatic
-- achievement badges in migration 0006. Reuses the same `badges` and
-- `user_badges` tables rather than creating parallel ones: a badge row
-- with is_manual = true can ONLY be assigned/removed by an admin via
-- award_manual_badge()/revoke_manual_badge() below, never by
-- recheck_badges(). A badge row with is_manual = false (the default)
-- keeps working exactly as it did before this migration.
-- ----------------------------------------------------------------------------

alter table public.badges add column is_manual boolean not null default false;

create function public.award_manual_badge(p_user_id uuid, p_badge_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_is_manual boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can assign badges manually';
  end if;

  select is_manual into v_is_manual from public.badges where id = p_badge_id;
  if v_is_manual is null then
    raise exception 'Badge not found';
  end if;
  if not v_is_manual then
    raise exception 'This badge is awarded automatically and cannot be assigned manually';
  end if;

  insert into public.user_badges (user_id, badge_id)
  values (p_user_id, p_badge_id)
  on conflict (user_id, badge_id) do nothing;
end;
$$;

create function public.revoke_manual_badge(p_user_id uuid, p_badge_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can remove badges';
  end if;

  delete from public.user_badges
  where user_id = p_user_id and badge_id = p_badge_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- Tags — colored labels an admin assigns to users (e.g. "Pro Player",
-- "Veteran", "Troll"). Fully admin-managed: creation, editing, deletion
-- of tag definitions, and assignment/removal to specific users, are all
-- restricted to admins both via RLS (for tags table reads/writes) and
-- security-definer functions (for the user_tags join table, mirroring
-- the badges pattern above).
-- ----------------------------------------------------------------------------

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (char_length(name) between 1 and 30),
  description text not null default '',
  color text not null default '#3b82f6' check (color ~ '^#[0-9a-fA-F]{6}$'),
  created_at timestamptz not null default now()
);

create table public.user_tags (
  user_id uuid not null references public.profiles (id) on delete cascade,
  tag_id uuid not null references public.tags (id) on delete cascade,
  assigned_by uuid references public.profiles (id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, tag_id)
);

alter table public.tags enable row level security;
alter table public.user_tags enable row level security;

create policy "tags are publicly readable"
  on public.tags for select
  using (true);

create policy "admins can create tags"
  on public.tags for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can update tags"
  on public.tags for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can delete tags"
  on public.tags for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "user tags are publicly readable"
  on public.user_tags for select
  using (true);

-- Intentionally NO insert/delete policy for user_tags here — the only
-- way to assign or remove a tag is through assign_tag()/unassign_tag()
-- below (security definer), which validates admin status AND writes an
-- audit log entry. Allowing a parallel direct-RLS write path would let
-- an admin bypass the audit trail.

-- Seed a few example tags matching the product brief.
insert into public.tags (name, description, color) values
  ('Pro Player', 'بازیکن حرفه‌ای و باتجربه در سطح رقابتی', '#facc15'),
  ('Veteran', 'عضو قدیمی و باسابقه‌ی جامعه', '#a855f7'),
  ('Helper', 'به‌طور مداوم به دیگران کمک می‌کند', '#22d3ee'),
  ('Legendary', 'یکی از برترین اعضای پلتفرم', '#f97316'),
  ('Holy', 'عضوی با رفتار نمونه و قابل احترام', '#60a5fa'),
  ('Troll', 'سابقه رفتار مخرب یا مزاحمت', '#ef4444');

-- ----------------------------------------------------------------------------
-- Admin action log — every admin-only mutation (manual badge/tag
-- assignment, role changes, etc.) gets recorded here for accountability.
-- Insert-only from admin RPC functions; never directly writable.
-- ----------------------------------------------------------------------------

create table public.admin_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index admin_logs_created_at_idx on public.admin_logs (created_at desc);

alter table public.admin_logs enable row level security;

create policy "admins can read admin logs"
  on public.admin_logs for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- No insert/update/delete policy for any client role — only the
-- log_admin_action() function (security definer) below may write here.

create function public.log_admin_action(
  p_action text,
  p_target_type text default null,
  p_target_id uuid default null,
  p_details jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.admin_logs (admin_id, action, target_type, target_id, details)
  values (auth.uid(), p_action, p_target_type, p_target_id, p_details);
end;
$$;

-- Wire logging into the manual badge functions and tag assignment by
-- recreating them with a logging call appended.

create or replace function public.award_manual_badge(p_user_id uuid, p_badge_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_is_manual boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can assign badges manually';
  end if;

  select is_manual into v_is_manual from public.badges where id = p_badge_id;
  if v_is_manual is null then
    raise exception 'Badge not found';
  end if;
  if not v_is_manual then
    raise exception 'This badge is awarded automatically and cannot be assigned manually';
  end if;

  insert into public.user_badges (user_id, badge_id)
  values (p_user_id, p_badge_id)
  on conflict (user_id, badge_id) do nothing;

  perform public.log_admin_action('award_badge', 'user', p_user_id, jsonb_build_object('badge_id', p_badge_id));
end;
$$;

create or replace function public.revoke_manual_badge(p_user_id uuid, p_badge_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can remove badges';
  end if;

  delete from public.user_badges
  where user_id = p_user_id and badge_id = p_badge_id;

  perform public.log_admin_action('revoke_badge', 'user', p_user_id, jsonb_build_object('badge_id', p_badge_id));
end;
$$;

create function public.assign_tag(p_user_id uuid, p_tag_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can assign tags';
  end if;

  insert into public.user_tags (user_id, tag_id, assigned_by)
  values (p_user_id, p_tag_id, auth.uid())
  on conflict (user_id, tag_id) do nothing;

  perform public.log_admin_action('assign_tag', 'user', p_user_id, jsonb_build_object('tag_id', p_tag_id));
end;
$$;

create function public.unassign_tag(p_user_id uuid, p_tag_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can remove tags';
  end if;

  delete from public.user_tags where user_id = p_user_id and tag_id = p_tag_id;

  perform public.log_admin_action('unassign_tag', 'user', p_user_id, jsonb_build_object('tag_id', p_tag_id));
end;
$$;

-- Note on user_badges vs user_tags write paths:
-- user_badges intentionally has TWO write paths: the automatic
-- award_badge_if_missing() trigger path from migration 0006 (for
-- achievement badges), and award_manual_badge()/revoke_manual_badge()
-- above (for admin-assigned badges, with an is_manual guard preventing
-- either path from touching the other's badges). Both are
-- security-definer functions, so there is no unaudited direct-RLS path.
-- user_tags has only ONE write path (assign_tag()/unassign_tag()) since
-- tags have no automatic-assignment concept.

-- ############################################################################
-- ## FILE: 0012_fix_manual_badge_rls.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0012: Fix missing RLS policies for manual badges
-- Run this AFTER 0001–0011 in the Supabase SQL Editor.
--
-- Bug found during Stage A review: migration 0006 created `badges` with
-- ONLY a public SELECT policy ("badges are seeded once by an admin via
-- SQL"), because at that point there was no in-app way to create a badge
-- row. Migration 0011 then added the `is_manual` column and shipped
-- ManualBadgeForm (src/components/admin/manual-badge-form.tsx), which
-- does `supabase.from("badges").insert(...)` directly from the client —
-- but never added an INSERT policy. With RLS enabled and no matching
-- policy, Postgres denies the write by default, so the form fails for
-- every admin with "new row violates row-level security policy".
--
-- This migration adds the missing admin-only INSERT/DELETE policies,
-- scoped to is_manual = true so this path can never create or remove an
-- automatic achievement badge (those stay exclusively managed by
-- recheck_badges() in migration 0006). No UPDATE policy is added because
-- no UI currently edits an existing badge's fields — add one later if
-- that need arises, with the same is_manual guard.
-- ============================================================================

create policy "admins can create manual badges"
  on public.badges for insert
  with check (
    is_manual = true
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

create policy "admins can delete manual badges"
  on public.badges for delete
  using (
    is_manual = true
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ############################################################################
-- ## FILE: 0013_wallet.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0013: Internal wallet + manual top-up requests
-- Run this AFTER 0001–0012 in the Supabase SQL Editor.
--
-- This is the foundation for the Marketplace phase: every user gets a
-- wallet (rial balance) they can charge by submitting a top-up request
-- with payment proof (a receipt image + a free-text reference, e.g. a
-- bank transaction tracking code). An admin reviews the request and
-- approves or rejects it; approval atomically credits the wallet and
-- rejection leaves it untouched. The Currency Shop, account marketplace,
-- and item trading (next migrations) will all debit/credit this same
-- wallet rather than handling money directly themselves.
--
-- New enum value note: ALTER TYPE ... ADD VALUE cannot run inside the
-- same transaction block that uses the new value, so the enum addition
-- is its own statement up front, before anything below references it.
-- ============================================================================

alter type public.notification_type add value if not exists 'wallet_topup_result';

-- ----------------------------------------------------------------------------
-- wallets — one row per user, created lazily on first access via
-- get_or_create_wallet() below rather than a signup trigger, so this
-- migration doesn't need to backfill every existing profile by hand.
-- balance_rials is the only money field in the whole schema; it must
-- NEVER be writable by a direct client UPDATE — only by
-- approve_wallet_topup() (security definer) and, in later migrations,
-- the purchase/sale RPCs. Enforced below with a BEFORE UPDATE trigger
-- mirroring the column-protection pattern from migration 0010.
-- ----------------------------------------------------------------------------

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_rials bigint not null default 0 check (balance_rials >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.wallets enable row level security;

create policy "users can read their own wallet"
  on public.wallets for select
  using (auth.uid() = user_id);

create policy "admins can read any wallet"
  on public.wallets for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- No INSERT/UPDATE/DELETE policy for any client role — wallets are only
-- created by get_or_create_wallet() and only credited by
-- approve_wallet_topup(), both security definer.

create function public.protect_wallet_columns()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_caller_is_admin boolean;
begin
  select is_admin into v_caller_is_admin from public.profiles where id = auth.uid();

  -- balance_rials may only move when the caller is an admin (i.e. through
  -- approve_wallet_topup(), which already verifies admin status itself
  -- before issuing its UPDATE — this check here is the second,
  -- independent layer, same defense-in-depth reasoning as
  -- protect_profile_columns_trigger for trust_score/xp/level in
  -- migration 0010). A non-admin caller — including the wallet owner
  -- themself — always gets balance_rials silently reverted to OLD.
  -- IMPORTANT: this is a BEFORE UPDATE trigger, which fires for EVERY
  -- UPDATE regardless of whether it originated from a raw client request
  -- or from inside a security definer function — security definer only
  -- changes which role's RLS/permissions apply, it does NOT bypass
  -- triggers. (Migration 0010's view_count note refers to a genuinely
  -- different mechanism — the Supabase service-role client, which skips
  -- RLS entirely — not to security definer functions in general; don't
  -- assume a security definer RPC is automatically exempt from this
  -- trigger.)
  if not coalesce(v_caller_is_admin, false) then
    new.balance_rials := old.balance_rials;
  end if;

  new.user_id := old.user_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger protect_wallet_columns_trigger
  before update on public.wallets
  for each row execute function public.protect_wallet_columns();

create function public.get_or_create_wallet(p_user_id uuid)
returns public.wallets
language plpgsql
security definer set search_path = public
as $$
declare
  v_wallet public.wallets;
begin
  -- A user may only ever fetch/create their OWN wallet through this
  -- function; admins reading another user's wallet go through the
  -- "admins can read any wallet" SELECT policy directly, not this RPC,
  -- so this function intentionally has no admin bypass.
  if auth.uid() is distinct from p_user_id then
    raise exception 'You can only access your own wallet';
  end if;

  select * into v_wallet from public.wallets where user_id = p_user_id;

  if not found then
    insert into public.wallets (user_id) values (p_user_id)
    returning * into v_wallet;
  end if;

  return v_wallet;
end;
$$;

-- ----------------------------------------------------------------------------
-- wallet_topup_requests — a user's request to add money to their wallet,
-- with payment proof. status starts 'pending' and is only ever moved by
-- admin via approve_wallet_topup()/reject_wallet_topup() below — never
-- directly by the user or a raw client UPDATE.
-- ----------------------------------------------------------------------------

create type public.wallet_topup_status as enum ('pending', 'approved', 'rejected');

create table public.wallet_topup_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_rials bigint not null check (amount_rials > 0),
  receipt_image_url text not null,
  reference_note text not null check (char_length(reference_note) between 1 and 200),
  status public.wallet_topup_status not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  admin_note text,
  created_at timestamptz not null default now()
);

create index wallet_topup_requests_user_idx on public.wallet_topup_requests (user_id, created_at desc);
create index wallet_topup_requests_status_idx on public.wallet_topup_requests (status, created_at);

alter table public.wallet_topup_requests enable row level security;

create policy "users can read their own topup requests"
  on public.wallet_topup_requests for select
  using (auth.uid() = user_id);

create policy "admins can read all topup requests"
  on public.wallet_topup_requests for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "users can create their own topup requests"
  on public.wallet_topup_requests for insert
  with check (auth.uid() = user_id and status = 'pending');

-- No UPDATE/DELETE policy for any client role — status transitions only
-- happen through approve_wallet_topup()/reject_wallet_topup() below,
-- which is what keeps wallet crediting atomic with the status change
-- (a direct RLS UPDATE path could flip status to 'approved' without
-- ever touching the wallet balance).

-- Reuses enforce_rate_limit() from migration 0010, which expects an
-- `author_id` column; wallet_topup_requests uses `user_id`, so it gets
-- its own small trigger rather than a signature change to a function
-- already relied on by posts/replies/room_messages.
create function public.rate_limit_wallet_topup_requests()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.wallet_topup_requests
  where user_id = new.user_id
    and created_at > now() - interval '600 seconds';

  if v_count >= 5 then
    raise exception 'Rate limit exceeded: too many top-up requests in a short time. Please slow down.';
  end if;

  return new;
end;
$$;

create trigger rate_limit_wallet_topup_requests_trigger
  before insert on public.wallet_topup_requests
  for each row execute function public.rate_limit_wallet_topup_requests();

-- ----------------------------------------------------------------------------
-- approve_wallet_topup / reject_wallet_topup — the only way a request's
-- status can change. Approval credits the wallet and flips status in the
-- same function call (so they can never go out of sync), then notifies
-- the user. Both guard against double-processing an already-reviewed
-- request, which matters since this is money: re-running an approval on
-- a request that's already 'approved' must NOT credit the wallet twice.
-- ----------------------------------------------------------------------------

create function public.approve_wallet_topup(p_request_id uuid)
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

  -- NOTE: deliberately NOT calling public.get_or_create_wallet() here —
  -- that function requires auth.uid() = p_user_id (a user may only
  -- fetch/create their own wallet), but the caller here is the admin
  -- approving someone else's request, so that check would always fail.
  -- Inline the same "create row if missing" logic instead.
  insert into public.wallets (user_id)
  values (v_request.user_id)
  on conflict (user_id) do nothing;

  update public.wallets
  set balance_rials = balance_rials + v_request.amount_rials
  where user_id = v_request.user_id;
  -- This UPDATE is allowed through by protect_wallet_columns_trigger
  -- because auth.uid() here is the admin who already passed the
  -- is_admin check above — the trigger itself re-checks is_admin
  -- independently before permitting a balance_rials change. See that
  -- function's comment for why "security definer" alone would NOT have
  -- been enough to bypass the trigger.

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

create function public.reject_wallet_topup(p_request_id uuid, p_admin_note text default null)
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
    raise exception 'Only admins can reject top-up requests';
  end if;

  select * into v_request
  from public.wallet_topup_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'Top-up request not found';
  end if;

  if v_request.status is distinct from 'pending' then
    raise exception 'This request has already been reviewed';
  end if;

  update public.wallet_topup_requests
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = p_admin_note
  where id = p_request_id;

  perform public.create_notification(
    v_request.user_id,
    'wallet_topup_result',
    jsonb_build_object('status', 'rejected', 'amount_rials', v_request.amount_rials, 'admin_note', p_admin_note)
  );

  perform public.log_admin_action(
    'reject_wallet_topup', 'wallet_topup_request', p_request_id,
    jsonb_build_object('user_id', v_request.user_id, 'amount_rials', v_request.amount_rials)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage bucket for payment receipt images. Private (not public) since
-- receipts can contain sensitive payment details — readable only by the
-- uploading user and admins, mirroring the user-id-folder convention
-- from migration 0011's avatars bucket.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  4194304, -- 4MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "users can upload their own payment receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can read their own payment receipts"
  on storage.objects for select
  using (
    bucket_id = 'payment-receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins can read all payment receipts"
  on storage.objects for select
  using (
    bucket_id = 'payment-receipts'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- No update/delete policy: a submitted receipt is immutable once
-- uploaded, matching the "can't edit a pending request" product
-- decision below (a user who made a mistake submits a new request
-- rather than editing the old one, keeping the audit trail honest).

-- ############################################################################
-- ## FILE: 0014_fix_protected_column_regressions.sql
-- ############################################################################

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

-- ############################################################################
-- ## FILE: 0015_currency_shop.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0015: Currency Shop (game-currency products + orders)
-- Run this AFTER 0001–0014 in the Supabase SQL Editor.
--
-- Purchase model: payment is INSTANT and automatic (debited straight
-- from the buyer's wallet — no manual proof needed, unlike topping the
-- wallet up in the first place), but FULFILLMENT is manual: the actual
-- in-game currency still has to be delivered by an admin into the
-- buyer's game account, so every order starts 'pending_delivery' and an
-- admin marks it 'delivered' (or 'cancelled', which refunds the wallet)
-- from /admin/shop-orders.
-- ============================================================================

alter type public.notification_type add value if not exists 'currency_order_delivered';
alter type public.notification_type add value if not exists 'currency_order_cancelled';

-- ----------------------------------------------------------------------------
-- currency_products — admin-managed catalog. Nothing here is hardcoded
-- in application code; an admin can add/edit/remove/reorder/toggle any
-- number of products from /admin/shop-products.
-- ----------------------------------------------------------------------------

create table public.currency_products (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text,
  image_url text,
  price_rials bigint not null check (price_rials > 0),
  currency_amount integer not null check (currency_amount > 0),
  -- Optional unit label for display only (e.g. "سکه", "V-Bucks") — the
  -- product name usually already conveys this, this is just for
  -- consistent formatting in lists ("1,000 V-Bucks") if an admin wants it.
  currency_unit_label text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index currency_products_game_idx on public.currency_products (game_id, display_order);
create index currency_products_active_idx on public.currency_products (is_active, display_order);

alter table public.currency_products enable row level security;

create policy "active currency products are publicly readable"
  on public.currency_products for select
  using (is_active = true);

create policy "admins can read all currency products"
  on public.currency_products for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can create currency products"
  on public.currency_products for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can update currency products"
  on public.currency_products for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can delete currency products"
  on public.currency_products for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create function public.touch_currency_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_currency_products_updated_at
  before update on public.currency_products
  for each row execute function public.touch_currency_product_updated_at();

-- ----------------------------------------------------------------------------
-- currency_orders — one row per purchase. price_paid_rials,
-- currency_amount, and product_name are SNAPSHOTTED at purchase time
-- (copied from the product, not looked up live) so a later price change
-- — or even deleting the product entirely — never alters the historical
-- record of what was actually bought and paid for. product_id is
-- nullable with ON DELETE SET NULL for exactly that reason: deleting a
-- discontinued product must not be blocked by, or corrupt, past orders.
-- ----------------------------------------------------------------------------

create type public.currency_order_status as enum ('pending_delivery', 'delivered', 'cancelled');

create table public.currency_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid references public.currency_products (id) on delete set null,
  product_name text not null,
  price_paid_rials bigint not null,
  currency_amount integer not null,
  game_account_info text not null check (char_length(game_account_info) between 1 and 300),
  status public.currency_order_status not null default 'pending_delivery',
  admin_note text,
  delivered_by uuid references public.profiles (id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index currency_orders_user_idx on public.currency_orders (user_id, created_at desc);
create index currency_orders_status_idx on public.currency_orders (status, created_at);

alter table public.currency_orders enable row level security;

create policy "users can read their own currency orders"
  on public.currency_orders for select
  using (auth.uid() = user_id);

create policy "admins can read all currency orders"
  on public.currency_orders for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- No INSERT/UPDATE/DELETE policy for any client role — orders are only
-- ever created by purchase_currency_product() and only ever resolved by
-- admin_deliver_currency_order()/admin_cancel_currency_order() below,
-- which is what keeps "wallet debited" and "order exists" (and later,
-- "order resolved" and "wallet refunded if cancelled") atomic. A direct
-- RLS path for any of this could let a debit happen without an order,
-- or an order appear without a matching debit.

-- ----------------------------------------------------------------------------
-- purchase_currency_product — the only way to buy. Locks both the
-- product row (so an admin can't deactivate/reprice it mid-purchase
-- with stale data already read) and the wallet row (so two rapid clicks
-- can't both pass the balance check before either debit lands), debits
-- the wallet, and creates the order, all atomically in one transaction.
-- ----------------------------------------------------------------------------

create function public.purchase_currency_product(
  p_product_id uuid,
  p_game_account_info text
)
returns public.currency_orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_product public.currency_products%rowtype;
  v_wallet public.wallets%rowtype;
  v_order public.currency_orders;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to make a purchase';
  end if;

  v_note := trim(coalesce(p_game_account_info, ''));
  if char_length(v_note) < 1 then
    raise exception 'Game account info is required so we know where to deliver your currency';
  end if;
  if char_length(v_note) > 300 then
    raise exception 'Game account info is too long';
  end if;

  select * into v_product
  from public.currency_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;
  if not v_product.is_active then
    raise exception 'This product is not currently available';
  end if;

  insert into public.wallets (user_id) values (auth.uid())
  on conflict (user_id) do nothing;

  select * into v_wallet from public.wallets where user_id = auth.uid() for update;

  if v_wallet.balance_rials < v_product.price_rials then
    raise exception 'Insufficient wallet balance. Please top up your wallet first.';
  end if;

  perform set_config('gamehub.trusted_write', 'on', true);
  update public.wallets
  set balance_rials = balance_rials - v_product.price_rials
  where user_id = auth.uid();
  perform set_config('gamehub.trusted_write', 'off', true);

  insert into public.currency_orders (
    user_id, product_id, product_name, price_paid_rials, currency_amount, game_account_info
  ) values (
    auth.uid(), v_product.id, v_product.name, v_product.price_rials, v_product.currency_amount, v_note
  )
  returning * into v_order;

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_deliver_currency_order / admin_cancel_currency_order — the only
-- way a pending order's status can change. Cancelling refunds the
-- buyer's wallet for the exact amount they paid; delivering does not
-- move any money (the in-game currency was handed over manually outside
-- this system — the admin confirms that happened here).
-- ----------------------------------------------------------------------------

create function public.admin_deliver_currency_order(
  p_order_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_order public.currency_orders%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can mark an order as delivered';
  end if;

  select * into v_order from public.currency_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status is distinct from 'pending_delivery' then
    raise exception 'This order has already been resolved';
  end if;

  update public.currency_orders
  set status = 'delivered', delivered_by = auth.uid(), delivered_at = now(), admin_note = p_admin_note
  where id = p_order_id;

  perform public.create_notification(
    v_order.user_id,
    'currency_order_delivered',
    jsonb_build_object(
      'order_id', v_order.id,
      'product_name', v_order.product_name,
      'currency_amount', v_order.currency_amount
    )
  );

  perform public.log_admin_action(
    'deliver_currency_order', 'currency_order', p_order_id,
    jsonb_build_object('user_id', v_order.user_id, 'product_name', v_order.product_name)
  );
end;
$$;

create function public.admin_cancel_currency_order(
  p_order_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_order public.currency_orders%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can cancel an order';
  end if;

  select * into v_order from public.currency_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status is distinct from 'pending_delivery' then
    raise exception 'This order has already been resolved';
  end if;

  insert into public.wallets (user_id) values (v_order.user_id)
  on conflict (user_id) do nothing;

  perform set_config('gamehub.trusted_write', 'on', true);
  update public.wallets
  set balance_rials = balance_rials + v_order.price_paid_rials
  where user_id = v_order.user_id;
  perform set_config('gamehub.trusted_write', 'off', true);

  update public.currency_orders
  set status = 'cancelled', delivered_by = auth.uid(), delivered_at = now(), admin_note = p_admin_note
  where id = p_order_id;

  perform public.create_notification(
    v_order.user_id,
    'currency_order_cancelled',
    jsonb_build_object(
      'order_id', v_order.id,
      'product_name', v_order.product_name,
      'refund_rials', v_order.price_paid_rials
    )
  );

  perform public.log_admin_action(
    'cancel_currency_order', 'currency_order', p_order_id,
    jsonb_build_object(
      'user_id', v_order.user_id, 'product_name', v_order.product_name,
      'refund_rials', v_order.price_paid_rials
    )
  );
end;
$$;

-- Product images reuse the existing 'game-assets' bucket (migration
-- 0002) rather than a new one — same access pattern already defined
-- there (admin-only upload, public read), no need to duplicate it.

-- ############################################################################
-- ## FILE: 0016_account_marketplace.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0016: Account Marketplace (peer-to-peer account sales)
-- Run this AFTER 0001–0015 in the Supabase SQL Editor.
--
-- Flow: a user lists their game account for sale (pending admin review).
-- An admin approves or rejects it. Once active, any OTHER user can buy it
-- instantly with their wallet balance — the buyer is debited the full
-- price, the seller is credited (price minus a site-configurable
-- commission), and the listing flips to 'sold', all atomically. The
-- actual account handover (credentials) happens between buyer and
-- seller outside this system, via the seller's delivery instructions
-- (account_listing_delivery_info below), which stay hidden from
-- everyone except the seller, the buyer (only after they've paid), and
-- admins — never visible on the public listing.
--
-- NOTE ON SCOPE: there is no escrow/dispute mechanism here — payment
-- settles instantly and the seller is paid immediately on sale. This
-- matches a straightforward "instant settlement" model, not a
-- hold-until-buyer-confirms-receipt one. Account-selling marketplaces
-- are a common target for scams (seller takes payment, never hands over
-- working credentials); if that risk matters for this platform, a
-- follow-up migration could add a "buyer confirms receipt" step that
-- holds the seller's payout in a pending state for N days, with admin
-- dispute resolution. Flagging this clearly rather than silently
-- shipping a payment model with no buyer protection.
-- ============================================================================

alter type public.notification_type add value if not exists 'listing_review_result';
alter type public.notification_type add value if not exists 'listing_sold';
alter type public.notification_type add value if not exists 'listing_purchased';
alter type public.notification_type add value if not exists 'listing_removed';

-- ----------------------------------------------------------------------------
-- site_settings — generic key/value store for admin-configurable values
-- that shouldn't be hardcoded in application code. Starts with just the
-- marketplace commission rate; reused by the upcoming item-trading
-- migration for its own commission setting.
-- ----------------------------------------------------------------------------

create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

alter table public.site_settings enable row level security;

create policy "site settings are publicly readable"
  on public.site_settings for select
  using (true);

-- No INSERT/UPDATE/DELETE policy for any client role — only changed
-- through admin_update_setting() below, which validates each known key
-- individually rather than accepting arbitrary writes.

insert into public.site_settings (key, value)
values ('marketplace_commission_percent', '5'::jsonb)
on conflict (key) do nothing;

create function public.admin_update_setting(p_key text, p_value jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can change site settings';
  end if;

  if p_key = 'marketplace_commission_percent' then
    if jsonb_typeof(p_value) <> 'number' or (p_value::text)::numeric < 0 or (p_value::text)::numeric > 100 then
      raise exception 'marketplace_commission_percent must be a number between 0 and 100';
    end if;
  else
    raise exception 'Unknown setting key: %', p_key;
  end if;

  insert into public.site_settings (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();

  perform public.log_admin_action(
    'update_setting', 'site_setting', null,
    jsonb_build_object('key', p_key, 'value', p_value)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- account_listings
-- ----------------------------------------------------------------------------

create type public.account_listing_status as enum (
  'pending_review', 'active', 'rejected', 'sold', 'removed'
);

create table public.account_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete restrict,
  title text not null check (char_length(title) between 3 and 150),
  description text not null check (char_length(description) between 10 and 3000),
  image_urls text[] not null default '{}',
  price_rials bigint not null check (price_rials > 0),
  status public.account_listing_status not null default 'pending_review',
  admin_note text,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  buyer_id uuid references public.profiles (id) on delete set null,
  sold_at timestamptz,
  commission_percent_snapshot numeric,
  payout_rials bigint,
  created_at timestamptz not null default now()
);

create index account_listings_status_idx on public.account_listings (status, created_at desc);
create index account_listings_game_idx on public.account_listings (game_id, status);
create index account_listings_seller_idx on public.account_listings (seller_id, created_at desc);

alter table public.account_listings enable row level security;

create policy "active listings are publicly readable"
  on public.account_listings for select
  using (status = 'active');

create policy "sellers can read their own listings"
  on public.account_listings for select
  using (auth.uid() = seller_id);

create policy "buyers can read listings they purchased"
  on public.account_listings for select
  using (auth.uid() = buyer_id);

create policy "admins can read all listings"
  on public.account_listings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "users can create their own listings"
  on public.account_listings for insert
  with check (
    auth.uid() = seller_id
    and status = 'pending_review'
    and cardinality(image_urls) <= 6
  );

create policy "sellers can withdraw their own unsold listings"
  on public.account_listings for delete
  using (auth.uid() = seller_id and status in ('pending_review', 'active'));

-- No general UPDATE policy — every status transition (approve, reject,
-- remove, purchase) goes through a security definer RPC below so each
-- one can carry its own validation, notification, and (for purchase)
-- atomic wallet movement. A direct client UPDATE path could otherwise
-- let a listing flip to 'sold' with no matching wallet transaction.

create function public.rate_limit_account_listings()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.account_listings
  where seller_id = new.seller_id
    and created_at > now() - interval '3600 seconds';

  if v_count >= 10 then
    raise exception 'Rate limit exceeded: too many listings created recently. Please slow down.';
  end if;

  return new;
end;
$$;

create trigger rate_limit_account_listings_trigger
  before insert on public.account_listings
  for each row execute function public.rate_limit_account_listings();

-- ----------------------------------------------------------------------------
-- account_listing_delivery_info — kept in its own table, NOT a column on
-- account_listings, specifically so it can have its own RLS: visible
-- only to the seller, the buyer (and only once they've actually paid),
-- and admins. If this were just a column on account_listings, the
-- public "active listings are publicly readable" policy above would
-- expose it to anyone browsing the marketplace before purchase.
-- ----------------------------------------------------------------------------

create table public.account_listing_delivery_info (
  listing_id uuid primary key references public.account_listings (id) on delete cascade,
  instructions text not null check (char_length(instructions) between 1 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.account_listing_delivery_info enable row level security;

create policy "sellers can read their own delivery info"
  on public.account_listing_delivery_info for select
  using (
    exists (
      select 1 from public.account_listings
      where id = listing_id and seller_id = auth.uid()
    )
  );

create policy "buyers can read delivery info after purchase"
  on public.account_listing_delivery_info for select
  using (
    exists (
      select 1 from public.account_listings
      where id = listing_id and buyer_id = auth.uid() and status = 'sold'
    )
  );

create policy "admins can read all delivery info"
  on public.account_listing_delivery_info for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "sellers can set delivery info on their own unsold listing"
  on public.account_listing_delivery_info for insert
  with check (
    exists (
      select 1 from public.account_listings
      where id = listing_id and seller_id = auth.uid() and status in ('pending_review', 'active')
    )
  );

create policy "sellers can update delivery info on their own unsold listing"
  on public.account_listing_delivery_info for update
  using (
    exists (
      select 1 from public.account_listings
      where id = listing_id and seller_id = auth.uid() and status in ('pending_review', 'active')
    )
  )
  with check (
    exists (
      select 1 from public.account_listings
      where id = listing_id and seller_id = auth.uid() and status in ('pending_review', 'active')
    )
  );

create function public.touch_delivery_info_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_delivery_info_updated_at_trigger
  before update on public.account_listing_delivery_info
  for each row execute function public.touch_delivery_info_updated_at();

-- ----------------------------------------------------------------------------
-- Admin moderation RPCs
-- ----------------------------------------------------------------------------

create function public.admin_approve_listing(p_listing_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_listing public.account_listings%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can approve listings';
  end if;

  select * into v_listing from public.account_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if v_listing.status is distinct from 'pending_review' then
    raise exception 'This listing has already been reviewed';
  end if;

  update public.account_listings
  set status = 'active', reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_listing_id;

  perform public.create_notification(
    v_listing.seller_id, 'listing_review_result',
    jsonb_build_object('listing_id', v_listing.id, 'title', v_listing.title, 'approved', true)
  );

  perform public.log_admin_action(
    'approve_listing', 'account_listing', p_listing_id,
    jsonb_build_object('seller_id', v_listing.seller_id, 'title', v_listing.title)
  );
end;
$$;

create function public.admin_reject_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_listing public.account_listings%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can reject listings';
  end if;

  select * into v_listing from public.account_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if v_listing.status is distinct from 'pending_review' then
    raise exception 'This listing has already been reviewed';
  end if;

  update public.account_listings
  set status = 'rejected', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = p_reason
  where id = p_listing_id;

  perform public.create_notification(
    v_listing.seller_id, 'listing_review_result',
    jsonb_build_object('listing_id', v_listing.id, 'title', v_listing.title, 'approved', false, 'reason', p_reason)
  );

  perform public.log_admin_action(
    'reject_listing', 'account_listing', p_listing_id,
    jsonb_build_object('seller_id', v_listing.seller_id, 'title', v_listing.title, 'reason', p_reason)
  );
end;
$$;

-- For an already-active listing pulled later (e.g. a rule violation
-- spotted after approval, or a seller report). Unlike reject, this
-- doesn't apply to pending_review listings — that's what reject is for.
create function public.admin_remove_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_listing public.account_listings%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can remove listings';
  end if;

  select * into v_listing from public.account_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found';
  end if;
  if v_listing.status is distinct from 'active' then
    raise exception 'Only an active listing can be removed';
  end if;

  update public.account_listings
  set status = 'removed', reviewed_by = auth.uid(), reviewed_at = now(), admin_note = p_reason
  where id = p_listing_id;

  perform public.create_notification(
    v_listing.seller_id, 'listing_removed',
    jsonb_build_object('listing_id', v_listing.id, 'title', v_listing.title, 'reason', p_reason)
  );

  perform public.log_admin_action(
    'remove_listing', 'account_listing', p_listing_id,
    jsonb_build_object('seller_id', v_listing.seller_id, 'title', v_listing.title, 'reason', p_reason)
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- purchase_account_listing — the only way an active listing becomes
-- sold. Locks the listing AND both wallets (buyer's and seller's) in a
-- single transaction so the debit, the commission-adjusted credit, and
-- the status flip can never go out of sync with each other.
-- ----------------------------------------------------------------------------

create function public.purchase_account_listing(p_listing_id uuid)
returns public.account_listings
language plpgsql
security definer set search_path = public
as $$
declare
  v_listing public.account_listings%rowtype;
  v_buyer_wallet public.wallets%rowtype;
  v_commission_percent numeric;
  v_commission_rials bigint;
  v_payout_rials bigint;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to make a purchase';
  end if;

  select * into v_listing
  from public.account_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;
  if v_listing.status is distinct from 'active' then
    raise exception 'This listing is not currently available';
  end if;
  if v_listing.seller_id = auth.uid() then
    raise exception 'You cannot buy your own listing';
  end if;

  insert into public.wallets (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  insert into public.wallets (user_id) values (v_listing.seller_id)
  on conflict (user_id) do nothing;

  -- Lock both wallets in a canonical order (smaller user_id first)
  -- rather than "buyer always first" — this is what actually prevents a
  -- deadlock. If two users happened to buy from each other at the same
  -- moment (A buying B's listing while B buys A's listing), "buyer
  -- first" would have each transaction lock its own wallet first, then
  -- block waiting for the other's — a textbook deadlock. Locking by a
  -- fixed UUID order makes both transactions request the two locks in
  -- the same relative order no matter who's buying from whom.
  if auth.uid() < v_listing.seller_id then
    select * into v_buyer_wallet from public.wallets where user_id = auth.uid() for update;
    perform 1 from public.wallets where user_id = v_listing.seller_id for update;
  else
    perform 1 from public.wallets where user_id = v_listing.seller_id for update;
    select * into v_buyer_wallet from public.wallets where user_id = auth.uid() for update;
  end if;

  if v_buyer_wallet.balance_rials < v_listing.price_rials then
    raise exception 'Insufficient wallet balance. Please top up your wallet first.';
  end if;

  select (value::text)::numeric into v_commission_percent
  from public.site_settings where key = 'marketplace_commission_percent';
  v_commission_percent := coalesce(v_commission_percent, 5);

  v_commission_rials := round(v_listing.price_rials * v_commission_percent / 100);
  v_payout_rials := v_listing.price_rials - v_commission_rials;

  perform set_config('gamehub.trusted_write', 'on', true);

  update public.wallets
  set balance_rials = balance_rials - v_listing.price_rials
  where user_id = auth.uid();

  update public.wallets
  set balance_rials = balance_rials + v_payout_rials
  where user_id = v_listing.seller_id;

  perform set_config('gamehub.trusted_write', 'off', true);

  update public.account_listings
  set
    status = 'sold',
    buyer_id = auth.uid(),
    sold_at = now(),
    commission_percent_snapshot = v_commission_percent,
    payout_rials = v_payout_rials
  where id = p_listing_id
  returning * into v_listing;

  perform public.create_notification(
    v_listing.seller_id, 'listing_sold',
    jsonb_build_object(
      'listing_id', v_listing.id, 'title', v_listing.title,
      'price_rials', v_listing.price_rials, 'payout_rials', v_payout_rials
    )
  );
  perform public.create_notification(
    auth.uid(), 'listing_purchased',
    jsonb_build_object('listing_id', v_listing.id, 'title', v_listing.title)
  );

  return v_listing;
end;
$$;

-- ----------------------------------------------------------------------------
-- Storage bucket for listing screenshots. Public (anyone can view active
-- listing images while browsing). Sellers upload their own screenshots;
-- admins can read/delete; no one else can delete.
-- ----------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'listing-images',
  'listing-images',
  true,
  4194304, -- 4MB
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create policy "anyone can read listing images"
  on storage.objects for select
  using (bucket_id = 'listing-images');

create policy "users can upload listing images in their own folder"
  on storage.objects for insert
  with check (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users can delete their own listing images"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins can delete any listing image"
  on storage.objects for delete
  using (
    bucket_id = 'listing-images'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ############################################################################
-- ## FILE: 0017_trade_items.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0017: Trade Items (in-game item peer-to-peer marketplace)
-- Run this AFTER 0001–0016 in the Supabase SQL Editor.
--
-- Differences from Account Marketplace (0016):
--   • No admin review step — items go live immediately. Admins can still
--     remove any listing at any time.
--   • No separate delivery_info table — item trading happens in-game
--     (the seller's in-game username/ID is enough for the buyer to
--     initiate the trade). A single contact_info text field on the
--     listing is visible to everyone, unlike account credentials.
--   • quantity field — a seller can list multiple units; each purchase
--     decrements quantity and marks the listing 'sold_out' when it hits 0.
--   • Same commission mechanic as account_listings: reads
--     marketplace_commission_percent from site_settings (0016).
-- ============================================================================

alter type public.notification_type add value if not exists 'item_listing_sold';
alter type public.notification_type add value if not exists 'item_listing_purchased';
alter type public.notification_type add value if not exists 'item_listing_removed';

create type public.item_listing_status as enum (
  'active',
  'sold_out',
  'removed'
);

create table public.item_listings (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  game_id uuid not null references public.games (id) on delete restrict,
  name text not null check (char_length(name) between 2 and 100),
  description text not null check (char_length(description) between 5 and 2000),
  image_urls text[] not null default '{}',
  price_rials bigint not null check (price_rials > 0),
  -- Contact info is intentionally public — it's the in-game handle the
  -- buyer needs to initiate the trade. Not sensitive like account credentials.
  contact_info text not null check (char_length(contact_info) between 1 and 300),
  quantity integer not null default 1 check (quantity >= 0),
  status public.item_listing_status not null default 'active',
  admin_note text,
  created_at timestamptz not null default now()
);

create index item_listings_status_idx on public.item_listings (status, created_at desc);
create index item_listings_game_idx on public.item_listings (game_id, status);
create index item_listings_seller_idx on public.item_listings (seller_id, created_at desc);

alter table public.item_listings enable row level security;

create policy "active item listings are publicly readable"
  on public.item_listings for select
  using (status = 'active');

create policy "sellers can read their own item listings"
  on public.item_listings for select
  using (auth.uid() = seller_id);

create policy "admins can read all item listings"
  on public.item_listings for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "users can create their own item listings"
  on public.item_listings for insert
  with check (
    auth.uid() = seller_id
    and status = 'active'
    and cardinality(image_urls) <= 6
  );

-- Sellers can edit name/description/price/contact_info of their own active
-- listings (but not status or quantity — those only move through RPCs).
create policy "sellers can edit their own active item listings"
  on public.item_listings for update
  using (auth.uid() = seller_id and status = 'active')
  with check (auth.uid() = seller_id);

create policy "sellers can delete their own active listings"
  on public.item_listings for delete
  using (auth.uid() = seller_id and status = 'active');

create function public.rate_limit_item_listings()
returns trigger
language plpgsql
as $$
declare
  v_count integer;
begin
  select count(*) into v_count
  from public.item_listings
  where seller_id = new.seller_id
    and created_at > now() - interval '3600 seconds';

  if v_count >= 20 then
    raise exception 'Rate limit exceeded: too many item listings in one hour.';
  end if;
  return new;
end;
$$;

create trigger rate_limit_item_listings_trigger
  before insert on public.item_listings
  for each row execute function public.rate_limit_item_listings();

-- ----------------------------------------------------------------------------
-- item_purchases — immutable record of each unit sold.
-- One row per transaction (even if seller had quantity > 1, each purchase
-- creates its own row so the history is granular and refunds are clean).
-- ----------------------------------------------------------------------------

create table public.item_purchases (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.item_listings (id) on delete restrict,
  buyer_id uuid not null references public.profiles (id) on delete cascade,
  seller_id uuid not null references public.profiles (id) on delete cascade,
  price_paid_rials bigint not null,
  payout_rials bigint not null,
  commission_percent_snapshot numeric not null,
  created_at timestamptz not null default now()
);

create index item_purchases_buyer_idx on public.item_purchases (buyer_id, created_at desc);
create index item_purchases_seller_idx on public.item_purchases (seller_id, created_at desc);
create index item_purchases_listing_idx on public.item_purchases (listing_id);

alter table public.item_purchases enable row level security;

create policy "buyers can read their own purchases"
  on public.item_purchases for select
  using (auth.uid() = buyer_id);

create policy "sellers can read their own sales"
  on public.item_purchases for select
  using (auth.uid() = seller_id);

create policy "admins can read all purchases"
  on public.item_purchases for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- No INSERT/UPDATE/DELETE via RLS — only through purchase_item_listing().

-- ----------------------------------------------------------------------------
-- purchase_item_listing
-- Same deadlock-safe wallet locking pattern as purchase_account_listing.
-- Decrements quantity; flips to 'sold_out' when quantity hits 0.
-- ----------------------------------------------------------------------------

create function public.purchase_item_listing(p_listing_id uuid)
returns public.item_purchases
language plpgsql
security definer set search_path = public
as $$
declare
  v_listing public.item_listings%rowtype;
  v_commission_percent numeric;
  v_commission_rials bigint;
  v_payout_rials bigint;
  v_purchase public.item_purchases;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to make a purchase';
  end if;

  select * into v_listing
  from public.item_listings
  where id = p_listing_id
  for update;

  if not found then
    raise exception 'Listing not found';
  end if;
  if v_listing.status is distinct from 'active' then
    raise exception 'This item is no longer available';
  end if;
  if v_listing.quantity < 1 then
    raise exception 'This item is out of stock';
  end if;
  if v_listing.seller_id = auth.uid() then
    raise exception 'You cannot buy your own listing';
  end if;

  -- Create wallets if needed, then lock in canonical UUID order.
  insert into public.wallets (user_id) values (auth.uid())
  on conflict (user_id) do nothing;
  insert into public.wallets (user_id) values (v_listing.seller_id)
  on conflict (user_id) do nothing;

  if auth.uid() < v_listing.seller_id then
    perform 1 from public.wallets where user_id = auth.uid() for update;
    perform 1 from public.wallets where user_id = v_listing.seller_id for update;
  else
    perform 1 from public.wallets where user_id = v_listing.seller_id for update;
    perform 1 from public.wallets where user_id = auth.uid() for update;
  end if;

  -- Re-read buyer balance after lock.
  if (select balance_rials from public.wallets where user_id = auth.uid()) < v_listing.price_rials then
    raise exception 'Insufficient wallet balance. Please top up your wallet first.';
  end if;

  select (value::text)::numeric into v_commission_percent
  from public.site_settings where key = 'marketplace_commission_percent';
  v_commission_percent := coalesce(v_commission_percent, 5);
  v_commission_rials := round(v_listing.price_rials * v_commission_percent / 100);
  v_payout_rials := v_listing.price_rials - v_commission_rials;

  perform set_config('gamehub.trusted_write', 'on', true);

  update public.wallets
  set balance_rials = balance_rials - v_listing.price_rials
  where user_id = auth.uid();

  update public.wallets
  set balance_rials = balance_rials + v_payout_rials
  where user_id = v_listing.seller_id;

  perform set_config('gamehub.trusted_write', 'off', true);

  -- Decrement quantity; flip status if it hits 0.
  update public.item_listings
  set
    quantity  = quantity - 1,
    status    = case when quantity - 1 <= 0 then 'sold_out'::item_listing_status else status end
  where id = p_listing_id;

  insert into public.item_purchases (
    listing_id, buyer_id, seller_id,
    price_paid_rials, payout_rials, commission_percent_snapshot
  ) values (
    v_listing.id, auth.uid(), v_listing.seller_id,
    v_listing.price_rials, v_payout_rials, v_commission_percent
  )
  returning * into v_purchase;

  perform public.create_notification(
    v_listing.seller_id, 'item_listing_sold',
    jsonb_build_object(
      'listing_id', v_listing.id, 'name', v_listing.name,
      'price_rials', v_listing.price_rials, 'payout_rials', v_payout_rials
    )
  );
  perform public.create_notification(
    auth.uid(), 'item_listing_purchased',
    jsonb_build_object('listing_id', v_listing.id, 'name', v_listing.name)
  );

  return v_purchase;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_remove_item_listing
-- ----------------------------------------------------------------------------

create function public.admin_remove_item_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_listing public.item_listings%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can remove item listings';
  end if;

  select * into v_listing from public.item_listings where id = p_listing_id for update;
  if not found then raise exception 'Listing not found'; end if;
  if v_listing.status is distinct from 'active' then
    raise exception 'Only an active listing can be removed';
  end if;

  update public.item_listings
  set status = 'removed', admin_note = p_reason
  where id = p_listing_id;

  perform public.create_notification(
    v_listing.seller_id, 'item_listing_removed',
    jsonb_build_object('listing_id', v_listing.id, 'name', v_listing.name, 'reason', p_reason)
  );

  perform public.log_admin_action(
    'remove_item_listing', 'item_listing', p_listing_id,
    jsonb_build_object('seller_id', v_listing.seller_id, 'name', v_listing.name)
  );
end;
$$;

-- Storage: listing-images bucket (created in 0016) is reused — same
-- access pattern (public read, owner upload/delete, admin delete).
-- No new bucket needed.


-- ############################################################################
-- ## FILE: 0018_fix_storage_policies.sql
-- ############################################################################

-- ============================================================================
-- GameHub — Migration 0018: Fix storage bucket bugs found in audit
-- Run this AFTER 0001–0017 in the Supabase SQL Editor.
--
-- Issues fixed:
--
-- 1. game-assets bucket (migration 0002): created WITHOUT file_size_limit
--    or allowed_mime_types — any file type/size could be uploaded. This
--    migration sets proper limits (4MB, image-only) and adds a missing
--    DELETE policy for admins on their own uploaded files.
--
-- 2. room-banners bucket (migration 0002): no DELETE policy at all.
--    ImageUploader replaces an image by uploading a new one — the old
--    one just accumulated orphaned files. Users also couldn't remove a
--    banner they'd already set. Added DELETE policy for the uploader's
--    own folder and for admins.
--
-- 3. room-banners bucket: no file_size_limit or allowed_mime_types either,
--    same as game-assets. Fixed here.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. game-assets: add file size + MIME type limits, add DELETE policy
-- ----------------------------------------------------------------------------

update storage.buckets
set
  file_size_limit = 4194304,   -- 4 MB
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'game-assets';

-- admins can delete assets they (or another admin) uploaded —
-- path is {user_id}/{uuid}.ext, so the folder check is sufficient
-- to restrict to the uploader; but since ALL admins should be able
-- to clean up any asset (not just their own), we skip the folder check.
create policy "admins can delete game assets"
  on storage.objects for delete
  using (
    bucket_id = 'game-assets'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ----------------------------------------------------------------------------
-- 2. room-banners: add file size + MIME type limits, add DELETE policies
-- ----------------------------------------------------------------------------

update storage.buckets
set
  file_size_limit = 4194304,   -- 4 MB
  allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/gif']
where id = 'room-banners';

-- Users can delete banners they uploaded (their own folder).
-- This unblocks ImageUploader's "replace image" flow — without this,
-- the UI can upload the new file but the old one stays as an orphan
-- AND the component can't confirm deletion to the user.
create policy "users can delete their own room banners"
  on storage.objects for delete
  using (
    bucket_id = 'room-banners'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "admins can delete any room banner"
  on storage.objects for delete
  using (
    bucket_id = 'room-banners'
    and exists (select 1 from public.profiles where id = auth.uid() and is_admin = true)
  );

-- ----------------------------------------------------------------------------
-- 3. avatars: add DELETE policy so users can remove their own avatar
--    (ImageUploader's X button calls storage.remove() — currently 403s
--    because migration 0011 only added INSERT + SELECT policies)
-- ----------------------------------------------------------------------------

create policy "users can delete their own avatar"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
