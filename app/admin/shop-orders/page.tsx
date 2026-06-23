import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { Card, PillBadge, Avatar } from "@/components/ui/card";
import { ResolveCurrencyOrderForm } from "@/components/admin/resolve-currency-order-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

const statusMeta = {
  pending_delivery: { label: "در انتظار تحویل", tone: "neutral" as const },
  delivered: { label: "تحویل شده", tone: "green" as const },
  cancelled: { label: "لغو شده", tone: "red" as const },
};

export default async function AdminShopOrdersPage() {
  const { supabase } = await requireAdmin();

  const { data: orders } = await supabase
    .from("currency_orders")
    .select("*, buyer:profiles!currency_orders_user_id_fkey(username, avatar_url)")
    .order("created_at", { ascending: false });

  const sorted = [...(orders ?? [])].sort((a, b) => {
    if (a.status === "pending_delivery" && b.status !== "pending_delivery") return -1;
    if (b.status === "pending_delivery" && a.status !== "pending_delivery") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = sorted.filter((o) => o.status === "pending_delivery").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">سفارش‌های فروشگاه ارز بازی</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {pendingCount > 0
            ? `${pendingCount} سفارش در انتظار تحویل`
            : "هیچ سفارش در انتظار تحویلی نیست"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          <ShoppingBag className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
          هنوز هیچ سفارشی ثبت نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((order) => {
            const meta = statusMeta[order.status];
            const buyer = order.buyer as unknown as {
              username: string;
              avatar_url: string | null;
            } | null;

            return (
              <Card
                key={order.id}
                className={
                  order.status === "pending_delivery" ? "p-4 border-neon-blue/30" : "p-4 opacity-70"
                }
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                      <span className="font-medium">{order.product_name}</span>
                    </div>
                    {buyer && (
                      <Link
                        href={`/profile/${buyer.username}`}
                        className="flex items-center gap-1.5 mt-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors w-fit"
                      >
                        <Avatar src={buyer.avatar_url} alt={buyer.username} size={18} />@
                        {buyer.username}
                      </Link>
                    )}
                    <p className="text-xs text-foreground-subtle mt-1">
                      {formatToman(order.price_paid_rials)} تومان —{" "}
                      {order.currency_amount.toLocaleString("en-US")} واحد
                    </p>
                    <p className="text-xs text-foreground-subtle mt-1">
                      اطلاعات اکانت بازی: {order.game_account_info}
                    </p>
                    <p className="text-xs text-foreground-subtle mt-1">
                      {formatDistanceToNow(new Date(order.created_at), {
                        addSuffix: true,
                        locale: faIR,
                      })}
                    </p>
                  </div>
                </div>

                {order.status === "pending_delivery" && (
                  <ResolveCurrencyOrderForm orderId={order.id} />
                )}
                {order.status === "cancelled" && order.admin_note && (
                  <p className="text-xs text-red-400 mt-3 pt-3 border-t border-background-border">
                    دلیل لغو: {order.admin_note}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
