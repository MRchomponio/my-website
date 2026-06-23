import Link from "next/link";
import { Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card, PillBadge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireUser } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import type { ItemListingStatus } from "@/types/database";

const statusMeta: Record<ItemListingStatus, { label: string; tone: "green" | "neutral" | "red" }> = {
  active: { label: "فعال", tone: "green" },
  sold_out: { label: "تمام شد", tone: "neutral" },
  removed: { label: "حذف شده", tone: "red" },
};

export default async function MyItemListingsPage() {
  const { profile, supabase } = await requireUser();

  const { data: listings } = await supabase
    .from("item_listings")
    .select("id, name, price_rials, quantity, status, admin_note, created_at, games(name)")
    .eq("seller_id", profile.id)
    .order("created_at", { ascending: false });

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">آیتم‌های من</h1>
          <Link href="/trade/new"><Button size="sm"><Plus className="h-4 w-4" />آگهی جدید</Button></Link>
        </div>

        {!listings || listings.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">هنوز هیچ آیتمی نفروختی.</Card>
        ) : (
          <div className="space-y-3">
            {listings.map((item) => {
              const meta = statusMeta[item.status as ItemListingStatus];
              const game = item.games as unknown as { name: string } | null;
              return (
                <Card key={item.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">{item.name}</span>
                        <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                      </div>
                      {game && <p className="text-xs text-foreground-subtle mt-0.5">{game.name}</p>}
                      <p className="text-sm mt-1">
                        {formatToman(item.price_rials)} تومان — موجودی: {item.quantity}
                      </p>
                      {item.admin_note && <p className="text-xs text-red-400 mt-1">{item.admin_note}</p>}
                      <p className="text-xs text-foreground-subtle mt-1">
                        {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: faIR })}
                      </p>
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
