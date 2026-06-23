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
