import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

export default async function ItemPurchasesPage() {
  const { profile, supabase } = await requireUser();

  const { data: purchases } = await supabase
    .from("item_purchases")
    .select("id, price_paid_rials, created_at, listing:item_listings(name, contact_info, games(name))")
    .eq("buyer_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold">خریدهای آیتم</h1>

        {!purchases || purchases.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">هنوز هیچ آیتمی نخریدی.</Card>
        ) : (
          <div className="space-y-3">
            {purchases.map((p) => {
              const listing = p.listing as unknown as { name: string; contact_info: string; games: { name: string } | null } | null;
              return (
                <Card key={p.id} className="p-4">
                  <p className="font-medium">{listing?.name ?? "آیتم حذف‌شده"}</p>
                  {listing?.games && <p className="text-xs text-foreground-subtle mt-0.5">{listing.games.name}</p>}
                  <p className="text-sm mt-1">{formatToman(p.price_paid_rials)} تومان</p>
                  {listing?.contact_info && (
                    <p className="text-xs text-foreground-muted mt-1">تماس با فروشنده: {listing.contact_info}</p>
                  )}
                  <p className="text-xs text-foreground-subtle mt-1">
                    {formatDistanceToNow(new Date(p.created_at), { addSuffix: true, locale: faIR })}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
