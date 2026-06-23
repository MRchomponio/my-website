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
