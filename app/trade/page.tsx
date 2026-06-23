import Link from "next/link";
import Image from "next/image";
import { Plus, Package, Wallet as WalletIcon } from "lucide-react";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/supabase/rpc";
import { PurchaseItemButton } from "@/components/trade/purchase-item-button";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface SearchParams { game?: string; sort?: string }

export default async function TradePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { game: gameSlug, sort = "newest" } = await searchParams;
  const { profile, supabase } = await requireUser();

  const { data: wallet } = await getOrCreateWallet(supabase, profile.id);

  const { data: games } = await supabase
    .from("games").select("id, name, slug, accent_color").order("name");

  let query = supabase
    .from("item_listings")
    .select("id, name, description, image_urls, price_rials, quantity, contact_info, created_at, seller_id, games(name, accent_color), seller:profiles!item_listings_seller_id_fkey(username, avatar_url)")
    .eq("status", "active");

  if (gameSlug) {
    const game = games?.find((g) => g.slug === gameSlug);
    if (game) query = query.eq("game_id", game.id);
  }

  if (sort === "cheapest") query = query.order("price_rials", { ascending: true });
  else if (sort === "priciest") query = query.order("price_rials", { ascending: false });
  else query = query.order("created_at", { ascending: false });

  const { data: listings } = await query;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">بازار آیتم</h1>
            <p className="text-sm text-foreground-muted mt-1">آیتم‌های بازی رو بخر یا بفروش.</p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/wallet">
              <Card className="px-3.5 py-2 flex items-center gap-1.5 text-sm hover:border-neon-blue/40 transition-colors">
                <WalletIcon className="h-3.5 w-3.5 text-neon-green-glow" />
                {formatToman(wallet?.balance_rials ?? 0)} تومان
              </Card>
            </Link>
            <Link href="/trade/new"><Button size="sm"><Plus className="h-4 w-4" />فروش آیتم</Button></Link>
          </div>
        </div>

        <Suspense fallback={<div className="h-16 rounded-xl bg-background-elevated animate-pulse" />}>
          <MarketplaceFilters games={games ?? []} />
        </Suspense>

        {!listings || listings.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted mt-4">هیچ آیتمی پیدا نشد.</Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {listings.map((item) => {
              const game = item.games as unknown as { name: string; accent_color: string } | null;
              const cover = (item.image_urls as string[])?.[0] ?? null;
              const isSelf = item.seller_id === profile.id;

              return (
                <Card key={item.id} className="overflow-hidden flex flex-col">
                  <div className="relative w-full aspect-[4/3] bg-background-elevated">
                    {cover ? (
                      <Image src={cover} alt={item.name} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-foreground-subtle" />
                      </div>
                    )}
                    {game && (
                      <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm"
                        style={{ backgroundColor: `${game.accent_color}30`, color: game.accent_color }}>
                        {game.name}
                      </span>
                    )}
                  </div>
                  <div className="p-4 flex-1 flex flex-col">
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-xs text-foreground-muted mt-1 line-clamp-2 flex-1">{item.description}</p>
                    <p className="text-xs text-foreground-subtle mt-1">موجودی: {item.quantity}</p>
                    <p className="text-xs text-foreground-subtle mt-0.5">تماس: {item.contact_info}</p>
                    <div className="flex items-center justify-between mt-3">
                      <span className="font-bold">{formatToman(item.price_rials)} تومان</span>
                      {isSelf ? (
                        <span className="text-xs text-foreground-subtle">آگهی شما</span>
                      ) : (
                        <PurchaseItemButton
                          listingId={item.id} name={item.name}
                          priceRials={item.price_rials}
                          walletBalanceRials={wallet?.balance_rials ?? 0}
                          quantity={item.quantity}
                        />
                      )}
                    </div>
                    <p className="text-xs text-foreground-subtle mt-1.5">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: faIR })}
                    </p>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
