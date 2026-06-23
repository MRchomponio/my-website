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
