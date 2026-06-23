import Link from "next/link";
import { Wallet as WalletIcon, History } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/supabase/rpc";
import { ShopProductGrid } from "@/components/shop/shop-product-grid";

export default async function ShopPage() {
  const { profile, supabase } = await requireUser();

  const { data: wallet } = await getOrCreateWallet(supabase, profile.id);

  const { data: products } = await supabase
    .from("currency_products")
    .select("*, games(name, accent_color)")
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  const formattedProducts = (products ?? []).map((p) => {
    const game = p.games as unknown as { name: string; accent_color: string } | null;
    return {
      id: p.id,
      name: p.name,
      description: p.description,
      image_url: p.image_url,
      price_rials: p.price_rials,
      currency_amount: p.currency_amount,
      currency_unit_label: p.currency_unit_label,
      game_name: game?.name,
      game_accent_color: game?.accent_color,
    };
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">فروشگاه ارز بازی</h1>
            <p className="text-sm text-foreground-muted mt-1">
              با موجودی کیف‌پولت، ارز داخل بازی‌ها رو بخر.
            </p>
          </div>
          <Link href="/shop/orders">
            <Card className="px-4 py-2.5 flex items-center gap-2 text-sm hover:border-neon-blue/40 transition-colors">
              <History className="h-4 w-4" />
              سفارش‌های من
            </Card>
          </Link>
        </div>

        <Card className="p-4 flex items-center justify-between bg-gradient-to-l from-neon-green/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-neon-green/15 flex items-center justify-center">
              <WalletIcon className="h-5 w-5 text-neon-green-glow" />
            </div>
            <div>
              <p className="text-xs text-foreground-subtle">موجودی کیف‌پول</p>
              <p className="font-bold">{formatToman(wallet?.balance_rials ?? 0)} تومان</p>
            </div>
          </div>
          <Link href="/wallet" className="text-sm text-neon-blue-glow hover:underline">
            شارژ کیف‌پول
          </Link>
        </Card>

        <ShopProductGrid
          products={formattedProducts}
          walletBalanceRials={wallet?.balance_rials ?? 0}
        />
      </main>
    </div>
  );
}
