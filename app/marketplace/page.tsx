import Link from "next/link";
import { Plus, Wallet as WalletIcon } from "lucide-react";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/supabase/rpc";
import { MarketplaceFilters } from "@/components/marketplace/marketplace-filters";
import { ListingCard } from "@/components/marketplace/listing-card";

interface SearchParams {
  game?: string;
  sort?: string;
}

export default async function MarketplacePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { game: gameSlug, sort = "newest" } = await searchParams;
  const { profile, supabase } = await requireUser();

  const { data: wallet } = await getOrCreateWallet(supabase, profile.id);

  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug, accent_color")
    .order("name");

  let query = supabase
    .from("account_listings")
    .select(
      "id, title, description, image_urls, price_rials, created_at, games(name, accent_color), seller:profiles!account_listings_seller_id_fkey(username, avatar_url)"
    )
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
            <h1 className="text-2xl font-bold">مارکت‌پلیس اکانت</h1>
            <p className="text-sm text-foreground-muted mt-1">
              اکانت بازی بخر یا اکانت خودت رو بفروش.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/wallet">
              <Card className="px-3.5 py-2 flex items-center gap-1.5 text-sm hover:border-neon-blue/40 transition-colors">
                <WalletIcon className="h-3.5 w-3.5 text-neon-green-glow" />
                {formatToman(wallet?.balance_rials ?? 0)} تومان
              </Card>
            </Link>
            <Link href="/marketplace/new">
              <Button size="sm">
                <Plus className="h-4 w-4" />
                فروش اکانت
              </Button>
            </Link>
          </div>
        </div>

        <Suspense fallback={<div className="h-16 rounded-xl bg-background-elevated animate-pulse" />}>
          <MarketplaceFilters games={games ?? []} />
        </Suspense>

        {!listings || listings.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted mt-4">
            هیچ آگهی فعالی پیدا نشد.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={{
                  id: listing.id,
                  title: listing.title,
                  description: listing.description,
                  image_urls: listing.image_urls as string[],
                  price_rials: listing.price_rials,
                  created_at: listing.created_at,
                  game: listing.games as unknown as { name: string; accent_color: string } | null,
                  seller: listing.seller as unknown as { username: string; avatar_url: string | null } | null,
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
