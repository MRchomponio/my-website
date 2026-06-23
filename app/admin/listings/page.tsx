import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ReviewListingForm } from "@/components/admin/review-listing-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

// تعریف نوع برای Listing
type Listing = {
  id: string;
  title: string;
  image_urls: string[] | null;
  price_rials: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  games: { name: string } | null;
  seller: { username: string; avatar_url: string | null } | null;
};

// کامپوننت PillBadge ساده
const PillBadge = ({ tone, children }: { tone: "neutral" | "green" | "red" | "blue"; children: React.ReactNode }) => {
  const colors = {
    neutral: "bg-gray-500/10 text-gray-400",
    green: "bg-green-500/10 text-green-500",
    red: "bg-red-500/10 text-red-500",
    blue: "bg-blue-500/10 text-blue-500",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[tone]}`}>{children}</span>;
};

const statusMeta: Record<string, { label: string; tone: "neutral" | "green" | "red" | "blue" }> = {
  pending_review: { label: "در انتظار بررسی", tone: "neutral" },
  active: { label: "فعال", tone: "green" },
  rejected: { label: "رد شده", tone: "red" },
  sold: { label: "فروخته شد", tone: "blue" },
  removed: { label: "حذف شده", tone: "red" },
};

export default async function AdminListingsPage() {
  const { supabase } = await requireAdmin();

  const { data: listings } = await supabase
    .from("account_listings")
    .select(
      "id, title, image_urls, price_rials, status, admin_note, created_at, games(name), seller:profiles!account_listings_seller_id_fkey(username, avatar_url)"
    )
    .order("status", { ascending: true })
    .order("created_at", { ascending: false });

  const typedListings = listings as Listing[] | null;

  const sorted = [...(typedListings ?? [])].sort((a, b) => {
    if (a.status === "pending_review" && b.status !== "pending_review") return -1;
    if (b.status === "pending_review" && a.status !== "pending_review") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const pendingCount = sorted.filter((l) => l.status === "pending_review").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">مدیریت آگهی‌های اکانت</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {pendingCount > 0 ? `${pendingCount} آگهی در انتظار بررسی` : "هیچ آگهی در انتظار بررسی‌ای نیست"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          <Package className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
          هنوز هیچ آگهی‌ای ثبت نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((listing) => {
            const meta = statusMeta[listing.status] || { label: listing.status, tone: "neutral" };
            const game = listing.games as { name: string } | null;
            const seller = listing.seller as { username: string; avatar_url: string | null } | null;
            const cover = (listing.image_urls as string[])?.[0] ?? null;

            return (
              <Card key={listing.id}
                className={listing.status === "pending_review" ? "p-4 border-neon-blue/30" : "p-4 opacity-75"}>
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-xl shrink-0 relative overflow-hidden border border-background-border bg-background-elevated">
                    {cover ? (
                      <Image src={cover} alt={listing.title} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-foreground-subtle" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/marketplace/${listing.id}`} className="font-medium hover:text-neon-blue-glow transition-colors truncate">
                        {listing.title}
                      </Link>
                      <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                    </div>
                    {game && <p className="text-xs text-foreground-subtle mt-0.5">{game.name}</p>}
                    <p className="text-sm mt-1">{formatToman(listing.price_rials)} تومان</p>
                    {seller && (
                      <Link href={`/profile/${seller.username}`}
                        className="flex items-center gap-1.5 mt-1.5 text-xs text-foreground-muted hover:text-foreground w-fit">
                        <Avatar src={seller.avatar_url || undefined} alt={seller.username} size={16} />
                        @{seller.username}
                      </Link>
                    )}
                    <p className="text-xs text-foreground-subtle mt-1">
                      {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: faIR })}
                    </p>
                    {listing.admin_note && (
                      <p className="text-xs text-red-400 mt-1">{listing.admin_note}</p>
                    )}
                  </div>
                </div>
                {(listing.status === "pending_review" || listing.status === "active") && (
                  <ReviewListingForm listingId={listing.id} status={listing.status} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
