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
