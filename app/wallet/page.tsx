import { Wallet as WalletIcon, Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/supabase/rpc";
import { WalletTopupForm } from "@/components/wallet/wallet-topup-form";
import { WalletTopupHistory } from "@/components/wallet/wallet-topup-history";

export default async function WalletPage() {
  const { profile, supabase } = await requireUser();

  // get_or_create_wallet() rather than a plain select — guarantees the
  // row exists even for a user visiting /wallet for the very first time
  // (see migration 0013: wallets aren't created at signup, only lazily).
  const { data: wallet } = await getOrCreateWallet(supabase, profile.id);

  const { data: requests } = await supabase
    .from("wallet_topup_requests")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">کیف‌پول</h1>
          <p className="text-sm text-foreground-muted mt-1">
            موجودی کیف‌پولت رو شارژ کن تا بتونی از فروشگاه خرید کنی.
          </p>
        </div>

        <Card className="p-6 flex items-center gap-4 bg-gradient-to-l from-neon-green/10 to-transparent">
          <div className="w-12 h-12 rounded-2xl bg-neon-green/15 flex items-center justify-center shrink-0">
            <WalletIcon className="h-6 w-6 text-neon-green-glow" />
          </div>
          <div>
            <p className="text-xs text-foreground-subtle">موجودی فعلی</p>
            <p className="text-2xl font-bold">
              {formatToman(wallet?.balance_rials ?? 0)}{" "}
              <span className="text-sm font-normal text-foreground-muted">تومان</span>
            </p>
          </div>
        </Card>

        <div className="grid md:grid-cols-[1fr_1.2fr] gap-6">
          <Card className="p-5 h-fit">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold mb-4">
              <Plus className="h-4 w-4" />
              درخواست شارژ جدید
            </h2>
            <WalletTopupForm />
          </Card>

          <div>
            <h2 className="text-sm font-semibold text-foreground-muted mb-3">
              تاریخچه‌ی درخواست‌ها
            </h2>
            <WalletTopupHistory requests={requests ?? []} />
          </div>
        </div>
      </main>
    </div>
  );
}
