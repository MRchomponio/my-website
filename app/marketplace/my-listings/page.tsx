import Link from "next/link";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card, PillBadge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import type { AccountListingStatus } from "@/types/database";
import { WithdrawListingButton } from "@/components/marketplace/withdraw-listing-button";

const statusMeta: Record<AccountListingStatus, { label: string; tone: "neutral" | "green" | "red" | "blue" }> = {
  pending_review: { label: "در انتظار بررسی", tone: "neutral" },
  active: { label: "فعال", tone: "green" },
  rejected: { label: "رد شده", tone: "red" },
  sold: { label: "فروخته شد", tone: "blue" },
  removed: { label: "حذف شده", tone: "red" },
};

export default async function MyListingsPage() {
  const { profile, supabase } = await requireUser();

  const { data: listings } = await supabase
    .from("account_listings")
    .select("id, title, price_rials, status, admin_note, created_at, payout_rials, games(name)")
    .eq("seller_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">آگهی‌های من</h1>
          <Link href="/marketplace/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              آگهی جدید
            </Button>
          </Link>
        </div>

        {!listings || listings.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">
            هنوز هیچ آگهی‌ای ثبت نکردی.
          </Card>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => {
              const meta = statusMeta[listing.status as AccountListingStatus];
              const game = listing.games as unknown as { name: string } | null;
              return (
                <Card key={listing.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link href={`/marketplace/${listing.id}`} className="font-medium hover:text-neon-blue-glow transition-colors truncate">
                          {listing.title}
                        </Link>
                        <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                      </div>
                      {game && <p className="text-xs text-foreground-subtle mt-0.5">{game.name}</p>}
                      <p className="text-sm mt-1">{formatToman(listing.price_rials)} تومان</p>
                      {listing.status === "sold" && listing.payout_rials && (
                        <p className="text-xs text-neon-green-glow mt-0.5">
                          دریافتی: {formatToman(listing.payout_rials)} تومان (بعد از کمیسیون)
                        </p>
                      )}
                      {listing.admin_note && (
                        <p className="text-xs text-red-400 mt-1">{listing.admin_note}</p>
                      )}
                      <p className="text-xs text-foreground-subtle mt-1">
                        {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: faIR })}
                      </p>
                    </div>
                    {(listing.status === "pending_review" || listing.status === "active") && (
                      <WithdrawListingButton listingId={listing.id} />
                    )}
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
