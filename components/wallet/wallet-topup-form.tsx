"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { walletTopupFormSchema } from "@/lib/validations/wallet";

// Quick-pick amounts in toman, matching the schema's min/max (in rials).
const QUICK_AMOUNTS_TOMAN = [50_000, 100_000, 200_000, 500_000];

export function WalletTopupForm() {
  const router = useRouter();
  const [amountToman, setAmountToman] = useState<string>("");
  const [receiptPath, setReceiptPath] = useState<string | null>(null);
  const [referenceNote, setReferenceNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const amountRials = Math.round(Number(amountToman) * 10);

    const parsed = walletTopupFormSchema.safeParse({
      amount_rials: amountRials,
      receipt_image_url: receiptPath ?? "",
      reference_note: referenceNote,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      setError("برای ثبت درخواست باید وارد حساب بشی.");
      return;
    }

    const { error: insertError } = await supabase.from("wallet_topup_requests").insert({
      user_id: user.id,
      amount_rials: parsed.data.amount_rials,
      receipt_image_url: parsed.data.receipt_image_url,
      reference_note: parsed.data.reference_note,
    });

    setIsLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setSuccess(true);
    setAmountToman("");
    setReceiptPath(null);
    setReferenceNote("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="amount">
          مبلغ (تومان)
        </label>
        <Input
          id="amount"
          type="number"
          dir="ltr"
          inputMode="numeric"
          min={10_000}
          step={1000}
          value={amountToman}
          onChange={(e) => setAmountToman(e.target.value)}
          placeholder="مثلاً 100000"
          required
        />
        <div className="flex flex-wrap gap-2 mt-2">
          {QUICK_AMOUNTS_TOMAN.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setAmountToman(String(amount))}
              className="px-2.5 py-1 rounded-lg text-xs bg-background-elevated border border-background-border hover:border-neon-blue/40 transition-colors"
            >
              {amount.toLocaleString("en-US")} تومان
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">تصویر رسید پرداخت</label>
        <ImageUploader
          bucket="payment-receipts"
          value={receiptPath}
          onChange={setReceiptPath}
          label=""
          aspectRatio="square"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="referenceNote">
          کد پیگیری / توضیح تراکنش
        </label>
        <Textarea
          id="referenceNote"
          value={referenceNote}
          onChange={(e) => setReferenceNote(e.target.value)}
          placeholder="مثلاً کد پیگیری بانک یا شماره کارتی که ازش واریز کردی"
          maxLength={200}
          className="min-h-[70px]"
          required
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 rounded-xl bg-neon-green/10 border border-neon-green/30 px-3 py-2.5 text-sm text-neon-green-glow">
          <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
          <span>درخواست شارژ ثبت شد. بعد از بررسی ادمین، موجودیت به‌روز میشه.</span>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        ثبت درخواست شارژ
      </Button>
    </form>
  );
}
