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
