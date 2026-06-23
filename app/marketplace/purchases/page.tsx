import Link from "next/link";
import { Navbar } from "@/components/layout/navbar";
import { Card, PillBadge } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { Lock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

export default async function PurchasesPage() {
  const { profile, supabase } = await requireUser();

  const { data: listings } = await supabase
    .from("account_listings")
    .select("id, title, price_rials, sold_at, games(name)")
    .eq("buyer_id", profile.id)
    .eq("status", "sold")
    .order("sold_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">خریدهای من</h1>

        {!listings || listings.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">
            هنوز هیچ اکانتی نخریدی.
          </Card>
        ) : (
          <div className="space-y-3">
            {listings.map((listing) => {
              const game = listing.games as unknown as { name: string } | null;
              return (
                <Card key={listing.id} className="p-4">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <Link href={`/marketplace/${listing.id}`} className="font-medium hover:text-neon-blue-glow transition-colors">
                        {listing.title}
                      </Link>
                      {game && <p className="text-xs text-foreground-subtle mt-0.5">{game.name}</p>}
                      <p className="text-sm mt-1">{formatToman(listing.price_rials)} تومان</p>
                      {listing.sold_at && (
                        <p className="text-xs text-foreground-subtle mt-1">
                          {formatDistanceToNow(new Date(listing.sold_at), { addSuffix: true, locale: faIR })}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Lock className="h-3.5 w-3.5 text-neon-green-glow" />
                      <Link href={`/marketplace/${listing.id}`} className="text-xs text-neon-green-glow hover:underline">
                        اطلاعات اکانت
                      </Link>
                    </div>
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
