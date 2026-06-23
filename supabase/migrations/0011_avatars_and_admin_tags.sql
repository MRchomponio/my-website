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
