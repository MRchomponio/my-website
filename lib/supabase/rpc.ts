import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AccountListingStatus } from "@/types/database";

/**
 * Thin typed wrappers around Postgres RPC functions defined in
 * supabase/migrations/0004_trust_and_reports.sql. The Database type
 * doesn't model `Functions` (this project's type file is hand-written,
 * not generated), so .rpc() itself isn't fully typed — these wrappers
 * give callers a typed signature without needing `as any` scattered
 * through component code.
 */

export async function resolveReport(
  supabase: SupabaseClient<Database>,
  args: { reportId: string; isValid: boolean; penalty?: number }
) {
  return supabase.rpc("resolve_report", {
    p_report_id: args.reportId,
    p_is_valid: args.isValid,
    p_penalty: args.penalty ?? 0,
  });
}

export async function adminCloseRoom(
  supabase: SupabaseClient<Database>,
  roomId: string
) {
  return supabase.rpc("admin_close_room", { p_room_id: roomId });
}

export type GlobalSearchResultType = "post" | "user" | "game" | "room";

export interface GlobalSearchResult {
  result_type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string | null;
  accent_color: string | null;
  image_url: string | null;
  slug: string | null;
}

export async function globalSearch(
  supabase: SupabaseClient<Database>,
  query: string,
  limit = 8
) {
  return supabase.rpc("global_search", {
    p_query: query,
    p_limit: limit,
  }) as unknown as Promise<{
    data: GlobalSearchResult[] | null;
    error: { message: string } | null;
  }>;
}

export async function awardManualBadge(
  supabase: SupabaseClient<Database>,
  args: { userId: string; badgeId: string }
) {
  return supabase.rpc("award_manual_badge", {
    p_user_id: args.userId,
    p_badge_id: args.badgeId,
  });
}

export async function revokeManualBadge(
  supabase: SupabaseClient<Database>,
  args: { userId: string; badgeId: string }
) {
  return supabase.rpc("revoke_manual_badge", {
    p_user_id: args.userId,
    p_badge_id: args.badgeId,
  });
}

export async function assignTag(
  supabase: SupabaseClient<Database>,
  args: { userId: string; tagId: string }
) {
  return supabase.rpc("assign_tag", {
    p_user_id: args.userId,
    p_tag_id: args.tagId,
  });
}

export async function unassignTag(
  supabase: SupabaseClient<Database>,
  args: { userId: string; tagId: string }
) {
  return supabase.rpc("unassign_tag", {
    p_user_id: args.userId,
    p_tag_id: args.tagId,
  });
}

export interface WalletRow {
  user_id: string;
  balance_rials: number;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateWallet(
  supabase: SupabaseClient<Database>,
  userId: string
) {
  return supabase.rpc("get_or_create_wallet", { p_user_id: userId }) as unknown as Promise<{
    data: WalletRow | null;
    error: { message: string } | null;
  }>;
}

export async function approveWalletTopup(
  supabase: SupabaseClient<Database>,
  requestId: string
) {
  return supabase.rpc("approve_wallet_topup", { p_request_id: requestId });
}

export async function rejectWalletTopup(
  supabase: SupabaseClient<Database>,
  args: { requestId: string; adminNote?: string }
) {
  return supabase.rpc("reject_wallet_topup", {
    p_request_id: args.requestId,
    p_admin_note: args.adminNote ?? null,
  });
}

export interface CurrencyOrderRow {
  id: string;
  user_id: string;
  product_id: string | null;
  product_name: string;
  price_paid_rials: number;
  currency_amount: number;
  game_account_info: string;
  status: "pending_delivery" | "delivered" | "cancelled";
  admin_note: string | null;
  delivered_by: string | null;
  delivered_at: string | null;
  created_at: string;
}

export async function purchaseCurrencyProduct(
  supabase: SupabaseClient<Database>,
  args: { productId: string; gameAccountInfo: string }
) {
  return supabase.rpc("purchase_currency_product", {
    p_product_id: args.productId,
    p_game_account_info: args.gameAccountInfo,
  }) as unknown as Promise<{
    data: CurrencyOrderRow | null;
    error: { message: string } | null;
  }>;
}

export async function adminDeliverCurrencyOrder(
  supabase: SupabaseClient<Database>,
  args: { orderId: string; adminNote?: string }
) {
  return supabase.rpc("admin_deliver_currency_order", {
    p_order_id: args.orderId,
    p_admin_note: args.adminNote ?? null,
  });
}

export async function adminCancelCurrencyOrder(
  supabase: SupabaseClient<Database>,
  args: { orderId: string; adminNote?: string }
) {
  return supabase.rpc("admin_cancel_currency_order", {
    p_order_id: args.orderId,
    p_admin_note: args.adminNote ?? null,
  });
}

// ─── Account Marketplace ─────────────────────────────────────────────────────

export async function adminApproveListing(
  supabase: SupabaseClient<Database>,
  listingId: string
) {
  return supabase.rpc("admin_approve_listing", { p_listing_id: listingId });
}

export async function adminRejectListing(
  supabase: SupabaseClient<Database>,
  args: { listingId: string; reason: string }
) {
  return supabase.rpc("admin_reject_listing", {
    p_listing_id: args.listingId,
    p_reason: args.reason,
  });
}

export async function adminRemoveListing(
  supabase: SupabaseClient<Database>,
  args: { listingId: string; reason: string }
) {
  return supabase.rpc("admin_remove_listing", {
    p_listing_id: args.listingId,
    p_reason: args.reason,
  });
}

export interface AccountListingRow {
  id: string;
  seller_id: string;
  game_id: string;
  title: string;
  description: string;
  image_urls: string[];
  price_rials: number;
  status: AccountListingStatus;
  admin_note: string | null;
  buyer_id: string | null;
  sold_at: string | null;
  commission_percent_snapshot: number | null;
  payout_rials: number | null;
  created_at: string;
}

export async function purchaseAccountListing(
  supabase: SupabaseClient<Database>,
  listingId: string
) {
  return supabase.rpc("purchase_account_listing", {
    p_listing_id: listingId,
  }) as unknown as Promise<{
    data: AccountListingRow | null;
    error: { message: string } | null;
  }>;
}

export async function adminUpdateSetting(
  supabase: SupabaseClient<Database>,
  args: { key: string; value: unknown }
) {
  return supabase.rpc("admin_update_setting", {
    p_key: args.key,
    p_value: args.value,
  });
}

// ─── Trade Items ─────────────────────────────────────────────────────────────

export async function purchaseItemListing(
  supabase: SupabaseClient<Database>,
  listingId: string
) {
  return supabase.rpc("purchase_item_listing", {
    p_listing_id: listingId,
  });
}

export async function adminRemoveItemListing(
  supabase: SupabaseClient<Database>,
  args: { listingId: string; reason: string }
) {
  return supabase.rpc("admin_remove_item_listing", {
    p_listing_id: args.listingId,
    p_reason: args.reason,
  });
}
