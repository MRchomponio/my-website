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
