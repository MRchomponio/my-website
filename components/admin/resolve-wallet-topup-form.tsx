"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { approveWalletTopup, rejectWalletTopup } from "@/lib/supabase/rpc";

export function ResolveWalletTopupForm({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectNote, setShowRejectNote] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"approve" | "reject" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleApprove() {
    setError(null);
    setLoadingAction("approve");
    const supabase = createClient();
    const { error: rpcError } = await approveWalletTopup(supabase, requestId);
    setLoadingAction(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  async function handleReject() {
    if (!showRejectNote) {
      setShowRejectNote(true);
      return;
    }

    setError(null);
    setLoadingAction("reject");
    const supabase = createClient();
    const { error: rpcError } = await rejectWalletTopup(supabase, {
      requestId,
      adminNote: rejectNote || undefined,
    });
    setLoadingAction(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-3 pt-3 border-t border-background-border">
      {showRejectNote && (
        <Input
          value={rejectNote}
          onChange={(e) => setRejectNote(e.target.value)}
          placeholder="دلیل رد (اختیاری، به کاربر نمایش داده میشه)"
          className="h-9 text-sm"
          autoFocus
        />
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={handleApprove}
          isLoading={loadingAction === "approve"}
          disabled={loadingAction !== null}
          className="!bg-neon-green/15 !border !border-neon-green/40 !text-neon-green-glow"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          تایید و شارژ کیف‌پول
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleReject}
          isLoading={loadingAction === "reject"}
          disabled={loadingAction !== null}
        >
          <XCircle className="h-3.5 w-3.5" />
          {showRejectNote ? "تایید رد درخواست" : "رد درخواست"}
        </Button>
      </div>
    </div>
  );
}
