import { Card, PillBadge } from "@/components/ui/card";
import { PrivateImage } from "@/components/ui/private-image";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import type { Database } from "@/types/database";

type TopupRequest = Database["public"]["Tables"]["wallet_topup_requests"]["Row"];

const statusMeta = {
  pending: { label: "در انتظار بررسی", tone: "neutral" as const },
  approved: { label: "تایید شد", tone: "green" as const },
  rejected: { label: "رد شد", tone: "red" as const },
};

export function WalletTopupHistory({ requests }: { requests: TopupRequest[] }) {
  if (requests.length === 0) {
    return (
      <Card className="p-8 text-center text-foreground-muted">
        هنوز هیچ درخواست شارژی ثبت نکردی.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const meta = statusMeta[request.status];
        return (
          <Card key={request.id} className="p-4 flex items-start gap-4">
            <PrivateImage
              bucket="payment-receipts"
              path={request.receipt_image_url}
              alt="رسید پرداخت"
              className="w-16 h-16 rounded-lg border border-background-border shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{formatToman(request.amount_rials)} تومان</span>
                <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
              </div>
              <p className="text-xs text-foreground-subtle mt-1 truncate">
                {request.reference_note}
              </p>
              {request.status === "rejected" && request.admin_note && (
                <p className="text-xs text-red-400 mt-1">دلیل رد: {request.admin_note}</p>
              )}
              <p className="text-xs text-foreground-subtle mt-1">
                {formatDistanceToNow(new Date(request.created_at), {
                  addSuffix: true,
                  locale: faIR,
                })}
              </p>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
