"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, AlertCircle, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { purchaseCurrencyProduct } from "@/lib/supabase/rpc";
import { currencyPurchaseFormSchema } from "@/lib/validations/currency-shop";
import { formatToman } from "@/lib/utils";

interface Product {
  id: string;
  name: string;
  price_rials: number;
  currency_amount: number;
  currency_unit_label: string | null;
}

export function PurchaseProductDialog({
  product,
  walletBalanceRials,
  onClose,
}: {
  product: Product;
  walletBalanceRials: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const [gameAccountInfo, setGameAccountInfo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const canAfford = walletBalanceRials >= product.price_rials;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = currencyPurchaseFormSchema.safeParse({ game_account_info: gameAccountInfo });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await purchaseCurrencyProduct(supabase, {
      productId: product.id,
      gameAccountInfo: parsed.data.game_account_info,
    });
    setIsLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-background-surface border border-background-border p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold">{product.name}</h2>
            <p className="text-sm text-foreground-muted mt-0.5">
              {product.currency_amount.toLocaleString("en-US")} {product.currency_unit_label || "واحد"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-foreground-subtle hover:bg-background-elevated transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {success ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-neon-green/15 flex items-center justify-center mx-auto mb-3">
              <WalletIcon className="h-6 w-6 text-neon-green-glow" />
            </div>
            <p className="font-medium">سفارش ثبت شد!</p>
            <p className="text-sm text-foreground-muted mt-1">
              مبلغ از کیف‌پولت کسر شد. به‌زودی ارز توسط ادمین به اکانتت تحویل داده میشه.
            </p>
            <Button className="mt-4 w-full" onClick={onClose}>
              متوجه شدم
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-background-elevated px-3.5 py-2.5 text-sm">
              <span className="text-foreground-muted">قیمت</span>
              <span className="font-medium">{formatToman(product.price_rials)} تومان</span>
            </div>
            <div className="flex items-center justify-between rounded-xl bg-background-elevated px-3.5 py-2.5 text-sm">
              <span className="text-foreground-muted">موجودی کیف‌پول</span>
              <span className={canAfford ? "font-medium" : "font-medium text-red-400"}>
                {formatToman(walletBalanceRials)} تومان
              </span>
            </div>

            {!canAfford && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  موجودی کیف‌پولت کافی نیست.{" "}
                  <a href="/wallet" className="underline">
                    شارژ کیف‌پول
                  </a>
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="gameAccountInfo">
                اطلاعات اکانت بازی (برای تحویل)
              </label>
              <Textarea
                id="gameAccountInfo"
                value={gameAccountInfo}
                onChange={(e) => setGameAccountInfo(e.target.value)}
                placeholder="مثلاً آیدی بازی یا نام کاربری اکانتت"
                maxLength={300}
                className="min-h-[70px]"
                required
                disabled={!canAfford}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" isLoading={isLoading} disabled={!canAfford} className="w-full">
              تایید و پرداخت از کیف‌پول
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
