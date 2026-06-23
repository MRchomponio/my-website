import { ShoppingBag } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card, PillBadge } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

const statusMeta = {
  pending_delivery: { label: "در انتظار تحویل", tone: "neutral" as const },
  delivered: { label: "تحویل شده", tone: "green" as const },
  cancelled: { label: "لغو شده", tone: "red" as const },
};

export default async function ShopOrdersPage() {
  const { profile, supabase } = await requireUser();

  const { data: orders } = await supabase
    .from("currency_orders")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">سفارش‌های من</h1>
          <p className="text-sm text-foreground-muted mt-1">تاریخچه‌ی خریدهای فروشگاه ارز بازی.</p>
        </div>

        {!orders || orders.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">
            <ShoppingBag className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
            هنوز هیچ خریدی انجام ندادی.
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const meta = statusMeta[order.status];
              return (
                <Card key={order.id} className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-medium">{order.product_name}</span>
                    <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                  </div>
                  <p className="text-xs text-foreground-subtle mt-1.5">
                    {formatToman(order.price_paid_rials)} تومان —{" "}
                    {order.currency_amount.toLocaleString("en-US")} واحد
                  </p>
                  <p className="text-xs text-foreground-subtle mt-1">
                    اطلاعات اکانت: {order.game_account_info}
                  </p>
                  {order.status === "cancelled" && order.admin_note && (
                    <p className="text-xs text-red-400 mt-1">دلیل لغو: {order.admin_note}</p>
                  )}
                  <p className="text-xs text-foreground-subtle mt-1.5">
                    {formatDistanceToNow(new Date(order.created_at), {
                      addSuffix: true,
                      locale: faIR,
                    })}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
