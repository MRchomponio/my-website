"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck, PackageX, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { adminDeliverCurrencyOrder, adminCancelCurrencyOrder } from "@/lib/supabase/rpc";

export function ResolveCurrencyOrderForm({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [showCancelNote, setShowCancelNote] = useState(false);
  const [loadingAction, setLoadingAction] = useState<"deliver" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDeliver() {
    setError(null);
    setLoadingAction("deliver");
    const supabase = createClient();
    const { error: rpcError } = await adminDeliverCurrencyOrder(supabase, { orderId });
    setLoadingAction(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }
    router.refresh();
  }

  async function handleCancel() {
    if (!showCancelNote) {
      setShowCancelNote(true);
      return;
    }

    setError(null);
    setLoadingAction("cancel");
    const supabase = createClient();
    const { error: rpcError } = await adminCancelCurrencyOrder(supabase, {
      orderId,
      adminNote: note || undefined,
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
      {showCancelNote && (
        <Input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="دلیل لغو (اختیاری، به کاربر نمایش داده میشه)"
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
          onClick={handleDeliver}
          isLoading={loadingAction === "deliver"}
          disabled={loadingAction !== null}
          className="!bg-neon-green/15 !border !border-neon-green/40 !text-neon-green-glow"
        >
          <PackageCheck className="h-3.5 w-3.5" />
          تحویل داده شد
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleCancel}
          isLoading={loadingAction === "cancel"}
          disabled={loadingAction !== null}
        >
          <PackageX className="h-3.5 w-3.5" />
          {showCancelNote ? "تایید لغو و بازگشت وجه" : "لغو سفارش"}
        </Button>
      </div>
    </div>
  );
}
