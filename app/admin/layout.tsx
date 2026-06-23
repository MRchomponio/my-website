import Link from "next/link";
import {
  Gamepad2, Users, ShieldAlert, Flag, UserCog, Award, Tag,
  Wallet, Package, ShoppingBag, Store, FileText, Settings, LayoutDashboard,
} from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { requireAdmin } from "@/lib/auth-helpers";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { supabase } = await requireAdmin();

  const { count: pendingReportsCount } = await supabase
    .from("reports")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: pendingTopupsCount } = await supabase
    .from("wallet_topup_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");

  const { count: pendingOrdersCount } = await supabase
    .from("currency_orders")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_delivery");

  const { count: pendingListingsCount } = await supabase
    .from("account_listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending_review");

  return (
    <div className="min-h-screen">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8 flex gap-8">
        <aside className="w-48 shrink-0 hidden sm:block">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground-subtle uppercase tracking-wide mb-3 px-2">
            <ShieldAlert className="h-3.5 w-3.5" />
            ادمین
          </div>
          <nav className="space-y-1">
            <Link
              href="/admin"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <LayoutDashboard className="h-4 w-4" />
              داشبورد
            </Link>
            <div className="pt-2 pb-1 border-t border-background-border" />
            <Link
              href="/admin/users"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <UserCog className="h-4 w-4" />
              کاربران
            </Link>
            <Link
              href="/admin/games"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Gamepad2 className="h-4 w-4" />
              بازی‌ها
            </Link>
            <Link
              href="/admin/rooms"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Users className="h-4 w-4" />
              اتاق‌ها
            </Link>
            <Link
              href="/admin/badges"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Award className="h-4 w-4" />
              بج‌ها
            </Link>
            <Link
              href="/admin/tags"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Tag className="h-4 w-4" />
              تگ‌ها
            </Link>
            <Link
              href="/admin/wallet-topups"
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <span className="flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                شارژ کیف‌پول
              </span>
              {Boolean(pendingTopupsCount) && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {pendingTopupsCount}
                </span>
              )}
            </Link>
            <div className="pt-3 mt-1 border-t border-background-border" />
            <Link
              href="/admin/shop-products"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Package className="h-4 w-4" />
              محصولات فروشگاه
            </Link>
            <Link
              href="/admin/shop-orders"
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <span className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4" />
                سفارش‌های فروشگاه
              </span>
              {Boolean(pendingOrdersCount) && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {pendingOrdersCount}
                </span>
              )}
            </Link>
            <div className="pt-3 mt-1 border-t border-background-border" />
            <Link
              href="/admin/listings"
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <span className="flex items-center gap-2">
                <Store className="h-4 w-4" />
                آگهی‌های مارکت
              </span>
              {Boolean(pendingListingsCount) && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {pendingListingsCount}
                </span>
              )}
            </Link>
            <Link
              href="/admin/item-listings"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Package className="h-4 w-4" />
              آگهی‌های آیتم
            </Link>
            <div className="pt-3 mt-1 border-t border-background-border" />
            <Link
              href="/admin/reports"
              className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <span className="flex items-center gap-2">
                <Flag className="h-4 w-4" />
                گزارش‌ها
              </span>
              {Boolean(pendingReportsCount) && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
                  {pendingReportsCount}
                </span>
              )}
            </Link>
            <Link
              href="/admin/settings"
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <Settings className="h-4 w-4" />
              تنظیمات
            </Link>
          </nav>
        </aside>
        <div className="flex-1 min-w-0">{children}</div>
      </div>
    </div>
  );
}
