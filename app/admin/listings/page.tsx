import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { Card, PillBadge, Avatar } from "@/components/ui/card";
import { ReviewListingForm } from "@/components/admin/review-listing-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import type { AccountListingStatus } from "@/types/database";

const statusMeta: Record<AccountListingStatus, { label: string; tone: "neutral" | "green" | "red" | "blue" }> = {
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

  const sorted = [...(listings ?? [])].sort((a, b) => {
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
            const meta = statusMeta[listing.status as AccountListingStatus];
            const game = listing.games as unknown as { name: string } | null;
            const seller = listing.seller as unknown as { username: string; avatar_url: string | null } | null;
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
                        <Avatar src={seller.avatar_url} alt={seller.username} size={16} />
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
