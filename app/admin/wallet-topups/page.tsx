import Link from "next/link";
import { Wallet } from "lucide-react";
import { Card, PillBadge, Avatar } from "@/components/ui/card";
import { PrivateImage } from "@/components/ui/private-image";
import { ResolveWalletTopupForm } from "@/components/admin/resolve-wallet-topup-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

const statusMeta = {
  pending: { label: "در انتظار بررسی", tone: "neutral" as const },
  approved: { label: "تایید شده", tone: "green" as const },
  rejected: { label: "رد شده", tone: "red" as const },
};

export default async function AdminWalletTopupsPage() {
  const { supabase } = await requireAdmin();

  const { data: requests } = await supabase
    .from("wallet_topup_requests")
    .select("*, requester:profiles!wallet_topup_requests_user_id_fkey(username, avatar_url)")
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  // Same rationale as admin/reports: keep pending requests on top
  // regardless of enum alphabetical order, since those need attention.
  const sorted = [...(requests ?? [])].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = sorted.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">درخواست‌های شارژ کیف‌پول</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {pendingCount > 0
            ? `${pendingCount} درخواست در انتظار بررسی`
            : "هیچ درخواست در انتظار بررسی‌ای نیست"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          <Wallet className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
          هنوز هیچ درخواست شارژی ثبت نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((request) => {
            const meta = statusMeta[request.status];
            const requester = request.requester as unknown as {
              username: string;
              avatar_url: string | null;
            } | null;

            return (
              <Card
                key={request.id}
                className={request.status === "pending" ? "p-4 border-neon-blue/30" : "p-4 opacity-70"}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <PrivateImage
                      bucket="payment-receipts"
                      path={request.receipt_image_url}
                      alt="رسید پرداخت"
                      className="w-16 h-16 rounded-lg border border-background-border shrink-0"
                    />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                        <span className="font-medium">{formatToman(request.amount_rials)} تومان</span>
                      </div>
                      {requester && (
                        <Link
                          href={`/profile/${requester.username}`}
                          className="flex items-center gap-1.5 mt-1.5 text-xs text-foreground-muted hover:text-foreground transition-colors w-fit"
                        >
                          <Avatar src={requester.avatar_url} alt={requester.username} size={18} />@
                          {requester.username}
                        </Link>
                      )}
                      <p className="text-xs text-foreground-subtle mt-1">
                        کد پیگیری: {request.reference_note}
                      </p>
                      <p className="text-xs text-foreground-subtle mt-1">
                        {formatDistanceToNow(new Date(request.created_at), {
                          addSuffix: true,
                          locale: faIR,
                        })}
                      </p>
                    </div>
                  </div>
                </div>

                {request.status === "pending" && (
                  <ResolveWalletTopupForm requestId={request.id} />
                )}
                {request.status === "rejected" && request.admin_note && (
                  <p className="text-xs text-red-400 mt-3 pt-3 border-t border-background-border">
                    دلیل رد: {request.admin_note}
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
