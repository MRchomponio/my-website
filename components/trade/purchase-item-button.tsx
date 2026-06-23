"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ShoppingCart, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { purchaseItemListing } from "@/lib/supabase/rpc";
import { formatToman } from "@/lib/utils";

export function PurchaseItemButton({
  listingId,
  name,
  priceRials,
  walletBalanceRials,
  quantity,
}: {
  listingId: string;
  name: string;
  priceRials: number;
  walletBalanceRials: number;
  quantity: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const canAfford = walletBalanceRials >= priceRials;

  async function handlePurchase() {
    setError(null);
    setIsLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await purchaseItemListing(supabase, listingId);
    setIsLoading(false);

    if (rpcError) { setError((rpcError as { message: string }).message); return; }
    setSuccess(true);
    router.refresh();
  }

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={quantity < 1}>
        <ShoppingCart className="h-4 w-4" />
        خرید
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => !isLoading && setOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-background-surface border border-background-border p-6"
            onClick={(e) => e.stopPropagation()}>
            {success ? (
              <div className="text-center py-2">
                <CheckCircle2 className="h-10 w-10 text-neon-green-glow mx-auto mb-3" />
                <p className="font-semibold">خرید موفق!</p>
                <p className="text-sm text-foreground-muted mt-1">با فروشنده تماس بگیر تا trade رو انجام بدی.</p>
                <Button className="mt-4 w-full" onClick={() => { setOpen(false); router.push("/trade/purchases"); }}>
                  خریدهایم
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between mb-4">
                  <p className="font-semibold text-sm">{name}</p>
                  <button onClick={() => setOpen(false)} className="text-foreground-subtle hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">قیمت</span>
                    <span className="font-medium">{formatToman(priceRials)} تومان</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-foreground-muted">موجودی کیف‌پول</span>
                    <span className={canAfford ? "font-medium" : "font-medium text-red-400"}>
                      {formatToman(walletBalanceRials)} تومان
                    </span>
                  </div>
                </div>
                {!canAfford && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 mb-4">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>موجودی کافی نیست. <a href="/wallet" className="underline">شارژ کیف‌پول</a></span>
                  </div>
                )}
                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400 mb-4">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}
                <Button className="w-full" onClick={handlePurchase} isLoading={isLoading} disabled={!canAfford}>
                  پرداخت از کیف‌پول
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
