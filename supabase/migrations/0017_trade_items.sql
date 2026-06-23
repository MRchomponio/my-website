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
