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
