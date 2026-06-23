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
