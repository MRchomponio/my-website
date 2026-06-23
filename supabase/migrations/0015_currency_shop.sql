-- ============================================================================
-- GameHub — Migration 0015: Currency Shop (game-currency products + orders)
-- Run this AFTER 0001–0014 in the Supabase SQL Editor.
--
-- Purchase model: payment is INSTANT and automatic (debited straight
-- from the buyer's wallet — no manual proof needed, unlike topping the
-- wallet up in the first place), but FULFILLMENT is manual: the actual
-- in-game currency still has to be delivered by an admin into the
-- buyer's game account, so every order starts 'pending_delivery' and an
-- admin marks it 'delivered' (or 'cancelled', which refunds the wallet)
-- from /admin/shop-orders.
-- ============================================================================

alter type public.notification_type add value if not exists 'currency_order_delivered';
alter type public.notification_type add value if not exists 'currency_order_cancelled';

-- ----------------------------------------------------------------------------
-- currency_products — admin-managed catalog. Nothing here is hardcoded
-- in application code; an admin can add/edit/remove/reorder/toggle any
-- number of products from /admin/shop-products.
-- ----------------------------------------------------------------------------

create table public.currency_products (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 100),
  description text,
  image_url text,
  price_rials bigint not null check (price_rials > 0),
  currency_amount integer not null check (currency_amount > 0),
  -- Optional unit label for display only (e.g. "سکه", "V-Bucks") — the
  -- product name usually already conveys this, this is just for
  -- consistent formatting in lists ("1,000 V-Bucks") if an admin wants it.
  currency_unit_label text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index currency_products_game_idx on public.currency_products (game_id, display_order);
create index currency_products_active_idx on public.currency_products (is_active, display_order);

alter table public.currency_products enable row level security;

create policy "active currency products are publicly readable"
  on public.currency_products for select
  using (is_active = true);

create policy "admins can read all currency products"
  on public.currency_products for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can create currency products"
  on public.currency_products for insert
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can update currency products"
  on public.currency_products for update
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true))
  with check (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create policy "admins can delete currency products"
  on public.currency_products for delete
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

create function public.touch_currency_product_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger touch_currency_products_updated_at
  before update on public.currency_products
  for each row execute function public.touch_currency_product_updated_at();

-- ----------------------------------------------------------------------------
-- currency_orders — one row per purchase. price_paid_rials,
-- currency_amount, and product_name are SNAPSHOTTED at purchase time
-- (copied from the product, not looked up live) so a later price change
-- — or even deleting the product entirely — never alters the historical
-- record of what was actually bought and paid for. product_id is
-- nullable with ON DELETE SET NULL for exactly that reason: deleting a
-- discontinued product must not be blocked by, or corrupt, past orders.
-- ----------------------------------------------------------------------------

create type public.currency_order_status as enum ('pending_delivery', 'delivered', 'cancelled');

create table public.currency_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid references public.currency_products (id) on delete set null,
  product_name text not null,
  price_paid_rials bigint not null,
  currency_amount integer not null,
  game_account_info text not null check (char_length(game_account_info) between 1 and 300),
  status public.currency_order_status not null default 'pending_delivery',
  admin_note text,
  delivered_by uuid references public.profiles (id) on delete set null,
  delivered_at timestamptz,
  created_at timestamptz not null default now()
);

create index currency_orders_user_idx on public.currency_orders (user_id, created_at desc);
create index currency_orders_status_idx on public.currency_orders (status, created_at);

alter table public.currency_orders enable row level security;

create policy "users can read their own currency orders"
  on public.currency_orders for select
  using (auth.uid() = user_id);

create policy "admins can read all currency orders"
  on public.currency_orders for select
  using (exists (select 1 from public.profiles where id = auth.uid() and is_admin = true));

-- No INSERT/UPDATE/DELETE policy for any client role — orders are only
-- ever created by purchase_currency_product() and only ever resolved by
-- admin_deliver_currency_order()/admin_cancel_currency_order() below,
-- which is what keeps "wallet debited" and "order exists" (and later,
-- "order resolved" and "wallet refunded if cancelled") atomic. A direct
-- RLS path for any of this could let a debit happen without an order,
-- or an order appear without a matching debit.

-- ----------------------------------------------------------------------------
-- purchase_currency_product — the only way to buy. Locks both the
-- product row (so an admin can't deactivate/reprice it mid-purchase
-- with stale data already read) and the wallet row (so two rapid clicks
-- can't both pass the balance check before either debit lands), debits
-- the wallet, and creates the order, all atomically in one transaction.
-- ----------------------------------------------------------------------------

create function public.purchase_currency_product(
  p_product_id uuid,
  p_game_account_info text
)
returns public.currency_orders
language plpgsql
security definer set search_path = public
as $$
declare
  v_product public.currency_products%rowtype;
  v_wallet public.wallets%rowtype;
  v_order public.currency_orders;
  v_note text;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to make a purchase';
  end if;

  v_note := trim(coalesce(p_game_account_info, ''));
  if char_length(v_note) < 1 then
    raise exception 'Game account info is required so we know where to deliver your currency';
  end if;
  if char_length(v_note) > 300 then
    raise exception 'Game account info is too long';
  end if;

  select * into v_product
  from public.currency_products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product not found';
  end if;
  if not v_product.is_active then
    raise exception 'This product is not currently available';
  end if;

  insert into public.wallets (user_id) values (auth.uid())
  on conflict (user_id) do nothing;

  select * into v_wallet from public.wallets where user_id = auth.uid() for update;

  if v_wallet.balance_rials < v_product.price_rials then
    raise exception 'Insufficient wallet balance. Please top up your wallet first.';
  end if;

  perform set_config('gamehub.trusted_write', 'on', true);
  update public.wallets
  set balance_rials = balance_rials - v_product.price_rials
  where user_id = auth.uid();
  perform set_config('gamehub.trusted_write', 'off', true);

  insert into public.currency_orders (
    user_id, product_id, product_name, price_paid_rials, currency_amount, game_account_info
  ) values (
    auth.uid(), v_product.id, v_product.name, v_product.price_rials, v_product.currency_amount, v_note
  )
  returning * into v_order;

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- admin_deliver_currency_order / admin_cancel_currency_order — the only
-- way a pending order's status can change. Cancelling refunds the
-- buyer's wallet for the exact amount they paid; delivering does not
-- move any money (the in-game currency was handed over manually outside
-- this system — the admin confirms that happened here).
-- ----------------------------------------------------------------------------

create function public.admin_deliver_currency_order(
  p_order_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_order public.currency_orders%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can mark an order as delivered';
  end if;

  select * into v_order from public.currency_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status is distinct from 'pending_delivery' then
    raise exception 'This order has already been resolved';
  end if;

  update public.currency_orders
  set status = 'delivered', delivered_by = auth.uid(), delivered_at = now(), admin_note = p_admin_note
  where id = p_order_id;

  perform public.create_notification(
    v_order.user_id,
    'currency_order_delivered',
    jsonb_build_object(
      'order_id', v_order.id,
      'product_name', v_order.product_name,
      'currency_amount', v_order.currency_amount
    )
  );

  perform public.log_admin_action(
    'deliver_currency_order', 'currency_order', p_order_id,
    jsonb_build_object('user_id', v_order.user_id, 'product_name', v_order.product_name)
  );
end;
$$;

create function public.admin_cancel_currency_order(
  p_order_id uuid,
  p_admin_note text default null
)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_is_admin boolean;
  v_order public.currency_orders%rowtype;
begin
  select is_admin into v_is_admin from public.profiles where id = auth.uid();
  if not coalesce(v_is_admin, false) then
    raise exception 'Only admins can cancel an order';
  end if;

  select * into v_order from public.currency_orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found';
  end if;
  if v_order.status is distinct from 'pending_delivery' then
    raise exception 'This order has already been resolved';
  end if;

  insert into public.wallets (user_id) values (v_order.user_id)
  on conflict (user_id) do nothing;

  perform set_config('gamehub.trusted_write', 'on', true);
  update public.wallets
  set balance_rials = balance_rials + v_order.price_paid_rials
  where user_id = v_order.user_id;
  perform set_config('gamehub.trusted_write', 'off', true);

  update public.currency_orders
  set status = 'cancelled', delivered_by = auth.uid(), delivered_at = now(), admin_note = p_admin_note
  where id = p_order_id;

  perform public.create_notification(
    v_order.user_id,
    'currency_order_cancelled',
    jsonb_build_object(
      'order_id', v_order.id,
      'product_name', v_order.product_name,
      'refund_rials', v_order.price_paid_rials
    )
  );

  perform public.log_admin_action(
    'cancel_currency_order', 'currency_order', p_order_id,
    jsonb_build_object(
      'user_id', v_order.user_id, 'product_name', v_order.product_name,
      'refund_rials', v_order.price_paid_rials
    )
  );
end;
$$;

-- Product images reuse the existing 'game-assets' bucket (migration
-- 0002) rather than a new one — same access pattern already defined
-- there (admin-only upload, public read), no need to duplicate it.
