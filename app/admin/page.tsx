import { Users, MessageSquare, ShoppingBag, Store, Wallet, TrendingUp, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  tone?: "blue" | "green" | "purple" | "neutral";
}) {
  const tones = {
    blue: "bg-neon-blue/10 text-neon-blue-glow",
    green: "bg-neon-green/10 text-neon-green-glow",
    purple: "bg-neon-purple/10 text-neon-purple-glow",
    neutral: "bg-background-elevated text-foreground-muted",
  };
  return (
    <Card className="p-5 flex items-start gap-4">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-foreground-muted">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-foreground-subtle mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

export default async function AdminOverviewPage() {
  const { supabase } = await requireAdmin();

  // Run all counts in parallel
  const [
    { count: userCount },
    { count: postCount },
    { count: roomCount },
    { count: pendingTopups },
    { count: pendingOrders },
    { count: pendingListings },
    { data: walletSum },
    { data: shopRevenue },
    { data: marketRevenue },
    { data: tradeRevenue },
    { count: activeListings },
    { count: activeItemListings },
  ] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }),
    supabase.from("posts").select("id", { count: "exact", head: true }),
    supabase.from("rooms").select("id", { count: "exact", head: true }),
    supabase.from("wallet_topup_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("currency_orders").select("id", { count: "exact", head: true }).eq("status", "pending_delivery"),
    supabase.from("account_listings").select("id", { count: "exact", head: true }).eq("status", "pending_review"),
    supabase.from("wallets").select("balance_rials"),
    supabase.from("currency_orders").select("price_paid_rials").eq("status", "delivered"),
    supabase.from("account_listings").select("price_rials").eq("status", "sold"),
    supabase.from("item_purchases").select("price_paid_rials"),
    supabase.from("account_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
    supabase.from("item_listings").select("id", { count: "exact", head: true }).eq("status", "active"),
  ]);

  const totalWalletBalance = (walletSum ?? []).reduce((s, w) => s + (w.balance_rials ?? 0), 0);
  const shopRevenueTotal = (shopRevenue ?? []).reduce((s, o) => s + (o.price_paid_rials ?? 0), 0);
  const marketRevenueTotal = (marketRevenue ?? []).reduce((s, l) => s + (l.price_rials ?? 0), 0);
  const tradeRevenueTotal = (tradeRevenue ?? []).reduce((s, p) => s + (p.price_paid_rials ?? 0), 0);
  const totalGmv = shopRevenueTotal + marketRevenueTotal + tradeRevenueTotal;

  const pendingActions = (pendingTopups ?? 0) + (pendingOrders ?? 0) + (pendingListings ?? 0);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">داشبورد ادمین</h1>
        {pendingActions > 0 && (
          <p className="text-sm text-red-400 mt-1">
            {pendingActions} مورد در انتظار بررسی دارید.
          </p>
        )}
      </div>

      <div className="space-y-6">
        {/* Community */}
        <div>
          <p className="text-xs font-semibold text-foreground-subtle uppercase tracking-wider mb-3">جامعه</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard label="کاربران" value={userCount ?? 0} icon={Users} tone="blue" />
            <StatCard label="پست‌های فروم" value={postCount ?? 0} icon={MessageSquare} tone="purple" />
            <StatCard label="اتاق‌ها" value={roomCount ?? 0} icon={Users} tone="neutral" />
          </div>
        </div>

        {/* Finance */}
        <div>
          <p className="text-xs font-semibold text-foreground-subtle uppercase tracking-wider mb-3">مالی</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="موجودی کل کیف‌پول‌ها"
              value={`${formatToman(totalWalletBalance)} تومان`}
              icon={Wallet}
              tone="green"
            />
            <StatCard
              label="GMV کل (همه بخش‌ها)"
              value={`${formatToman(totalGmv)} تومان`}
              sub="ارز بازی + اکانت + آیتم"
              icon={TrendingUp}
              tone="green"
            />
            <StatCard
              label="فروش ارز بازی"
              value={`${formatToman(shopRevenueTotal)} تومان`}
              sub="سفارش‌های تحویل‌شده"
              icon={ShoppingBag}
              tone="neutral"
            />
          </div>
        </div>

        {/* Marketplace */}
        <div>
          <p className="text-xs font-semibold text-foreground-subtle uppercase tracking-wider mb-3">مارکت‌پلیس</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard
              label="آگهی‌های فعال اکانت"
              value={activeListings ?? 0}
              sub={pendingListings ? `${pendingListings} در انتظار بررسی` : undefined}
              icon={Store}
              tone="blue"
            />
            <StatCard
              label="حجم فروش اکانت"
              value={`${formatToman(marketRevenueTotal)} تومان`}
              icon={TrendingUp}
              tone="neutral"
            />
            <StatCard
              label="آگهی‌های فعال آیتم"
              value={activeItemListings ?? 0}
              icon={Package}
              tone="purple"
            />
          </div>
        </div>

        {/* Pending actions */}
        <div>
          <p className="text-xs font-semibold text-foreground-subtle uppercase tracking-wider mb-3">در انتظار بررسی</p>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard
              label="درخواست شارژ کیف‌پول"
              value={pendingTopups ?? 0}
              icon={Wallet}
              tone={pendingTopups ? "green" : "neutral"}
            />
            <StatCard
              label="سفارش‌های فروشگاه"
              value={pendingOrders ?? 0}
              icon={ShoppingBag}
              tone={pendingOrders ? "blue" : "neutral"}
            />
            <StatCard
              label="آگهی‌های اکانت"
              value={pendingListings ?? 0}
              icon={Store}
              tone={pendingListings ? "purple" : "neutral"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
