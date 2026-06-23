"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, Trash2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { adminApproveListing, adminRejectListing, adminRemoveListing } from "@/lib/supabase/rpc";

export function ReviewListingForm({
  listingId,
  status,
}: {
  listingId: string;
  status: string;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState(false);
  const [pendingAction, setPendingAction] = useState<"reject" | "remove" | null>(null);
  const [loading, setLoading] = useState<"approve" | "reject" | "remove" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setError(null);
    setLoading("approve");
    const supabase = createClient();
    const { error: e } = await adminApproveListing(supabase, listingId);
    setLoading(null);
    if (e) { setError(e.message); return; }
    router.refresh();
  }

  async function handleAction(action: "reject" | "remove") {
    if (!showReason || pendingAction !== action) {
      setPendingAction(action);
      setShowReason(true);
      return;
    }
    if (!reason.trim()) { setError("دلیل رو وارد کن"); return; }
    setError(null);
    setLoading(action);
    const supabase = createClient();
    const fn = action === "reject" ? adminRejectListing : adminRemoveListing;
    const { error: e } = await fn(supabase, { listingId, reason: reason.trim() });
    setLoading(null);
    if (e) { setError(e.message); return; }
    router.refresh();
  }

  return (
    <div className="space-y-3 pt-3 border-t border-background-border">
      {showReason && (
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={pendingAction === "reject" ? "دلیل رد..." : "دلیل حذف..."}
          className="h-9 text-sm"
          autoFocus
        />
      )}
      {error && (
        <div className="flex items-start gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          {error}
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        {status === "pending_review" && (
          <Button size="sm" onClick={handleApprove} isLoading={loading === "approve"} disabled={loading !== null}
            className="!bg-neon-green/15 !border !border-neon-green/40 !text-neon-green-glow">
            <CheckCircle2 className="h-3.5 w-3.5" />
            تایید
          </Button>
        )}
        {status === "pending_review" && (
          <Button size="sm" variant="ghost" onClick={() => handleAction("reject")} isLoading={loading === "reject"} disabled={loading !== null}>
            <XCircle className="h-3.5 w-3.5" />
            {showReason && pendingAction === "reject" ? "تایید رد" : "رد"}
          </Button>
        )}
        {status === "active" && (
          <Button size="sm" variant="ghost" onClick={() => handleAction("remove")} isLoading={loading === "remove"} disabled={loading !== null}>
            <Trash2 className="h-3.5 w-3.5" />
            {showReason && pendingAction === "remove" ? "تایید حذف" : "حذف"}
          </Button>
        )}
      </div>
    </div>
  );
}
