import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Card, Avatar, PillBadge } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { getOrCreateWallet } from "@/lib/supabase/rpc";
import { PurchaseListingButton } from "@/components/marketplace/purchase-listing-button";
import { Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface PageProps {
  params: Promise<{ listingId: string }>;
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { listingId } = await params;
  const { profile, supabase } = await requireUser();

  const { data: listing } = await supabase
    .from("account_listings")
    .select(
      "*, game:games(name, accent_color), seller:profiles!account_listings_seller_id_fkey(username, avatar_url, display_name)"
    )
    .eq("id", listingId)
    .maybeSingle();

  if (!listing || !["active", "sold"].includes(listing.status)) {
    notFound();
  }

  const { data: wallet } = await getOrCreateWallet(supabase, profile.id);

  // Delivery info visible only to seller and buyer (handled by RLS)
  const { data: delivery } = await supabase
    .from("account_listing_delivery_info")
    .select("instructions")
    .eq("listing_id", listingId)
    .maybeSingle();

  const isSeller = profile.id === listing.seller_id;
  const isBuyer = profile.id === listing.buyer_id;
  const game = listing.game as unknown as { name: string; accent_color: string } | null;
  const seller = listing.seller as unknown as {
    username: string;
    avatar_url: string | null;
    display_name: string | null;
  } | null;
  const images = listing.image_urls as string[];

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          {/* Left: images + description */}
          <div className="space-y-4">
            {images.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {images.map((url, i) => (
                  <div
                    key={i}
                    className={`relative aspect-[4/3] rounded-xl overflow-hidden border border-background-border bg-background-elevated ${i === 0 && images.length > 1 ? "col-span-2" : ""}`}
                  >
                    <Image src={url} alt={`تصویر ${i + 1}`} fill className="object-cover" unoptimized />
                  </div>
                ))}
              </div>
            )}

            <Card className="p-5">
              <h2 className="font-semibold mb-2">توضیحات</h2>
              <p className="text-sm text-foreground-muted whitespace-pre-wrap">
                {listing.description}
              </p>
            </Card>

            {/* Delivery info — only visible to seller/buyer via RLS */}
            {delivery && (isSeller || isBuyer) && (
              <Card className="p-5 border-neon-green/30">
                <div className="flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-neon-green-glow" />
                  <h2 className="font-semibold text-sm">اطلاعات تحویل</h2>
                </div>
                <p className="text-sm font-mono whitespace-pre-wrap text-foreground">
                  {delivery.instructions}
                </p>
              </Card>
            )}
          </div>

          {/* Right: price + action */}
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-2 mb-3">
                <h1 className="font-bold text-lg leading-snug">{listing.title}</h1>
                {listing.status === "sold" && (
                  <PillBadge tone="neutral">فروخته شد</PillBadge>
                )}
              </div>

              {game && (
                <span
                  className="inline-block text-xs px-2 py-0.5 rounded-full mb-3"
                  style={{ backgroundColor: `${game.accent_color}20`, color: game.accent_color }}
                >
                  {game.name}
                </span>
              )}

              <p className="text-2xl font-bold mb-1">{formatToman(listing.price_rials)} تومان</p>
              <p className="text-xs text-foreground-subtle mb-4">
                {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: faIR })}
              </p>

              {listing.status === "active" && !isSeller && (
                <PurchaseListingButton
                  listingId={listing.id}
                  title={listing.title}
                  priceRials={listing.price_rials}
                  walletBalanceRials={wallet?.balance_rials ?? 0}
                />
              )}
              {isSeller && listing.status === "active" && (
                <p className="text-xs text-foreground-subtle">این آگهی متعلق به شماست.</p>
              )}
            </Card>

            {seller && (
              <Card className="p-4">
                <p className="text-xs text-foreground-subtle mb-2">فروشنده</p>
                <Link
                  href={`/profile/${seller.username}`}
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity"
                >
                  <Avatar src={seller.avatar_url} alt={seller.username} size={32} />
                  <div>
                    <p className="text-sm font-medium">{seller.display_name || seller.username}</p>
                    <p className="text-xs text-foreground-subtle">@{seller.username}</p>
                  </div>
                </Link>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
