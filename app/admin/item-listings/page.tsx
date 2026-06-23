import Image from "next/image";
import Link from "next/link";
import { Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { RemoveItemListingForm } from "@/components/admin/remove-item-listing-form";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

// تعریف نوع برای ItemListing
type ItemListing = {
  id: string;
  name: string;
  image_urls: string[] | null;
  price_rials: number;
  quantity: number;
  status: string;
  admin_note: string | null;
  created_at: string;
  games: { name: string } | null;
  seller: { username: string; avatar_url: string | null } | null;
};

const statusMeta: Record<string, { label: string; tone: "green" | "neutral" | "red" }> = {
  active: { label: "فعال", tone: "green" },
  sold_out: { label: "تمام شد", tone: "neutral" },
  removed: { label: "حذف شده", tone: "red" },
};

// کامپوننت PillBadge ساده
const PillBadge = ({ tone, children }: { tone: "green" | "neutral" | "red"; children: React.ReactNode }) => {
  const colors = {
    green: "bg-green-500/10 text-green-500",
    neutral: "bg-gray-500/10 text-gray-400",
    red: "bg-red-500/10 text-red-500",
  };
  return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[tone]}`}>{children}</span>;
};

export default async function AdminItemListingsPage() {
  const { supabase } = await requireAdmin();

  const { data: listings } = await supabase
    .from("item_listings")
    .select("id, name, image_urls, price_rials, quantity, status, admin_note, created_at, games(name), seller:profiles!item_listings_seller_id_fkey(username, avatar_url)")
    .order("created_at", { ascending: false });

  const typedListings = listings as ItemListing[] | null;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">مدیریت آگهی‌های آیتم</h1>

      {!typedListings || typedListings.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          <Package className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
          هنوز هیچ آگهی آیتمی ثبت نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {typedListings.map((item) => {
            const meta = statusMeta[item.status] || { label: item.status, tone: "neutral" };
            const game = item.games as { name: string } | null;
            const seller = item.seller as { username: string; avatar_url: string | null } | null;
            const cover = (item.image_urls as string[])?.[0] ?? null;

            return (
              <Card key={item.id} className={item.status === "active" ? "p-4" : "p-4 opacity-70"}>
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl shrink-0 relative overflow-hidden border border-background-border bg-background-elevated">
                    {cover ? (
                      <Image src={cover} alt={item.name} fill className="object-cover" unoptimized />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-5 w-5 text-foreground-subtle" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium truncate">{item.name}</span>
                      <PillBadge tone={meta.tone}>{meta.label}</PillBadge>
                    </div>
                    {game && <p className="text-xs text-foreground-subtle mt-0.5">{game.name}</p>}
                    <p className="text-sm mt-1">{formatToman(item.price_rials)} تومان — موجودی: {item.quantity}</p>
                    {seller && (
                      <Link href={`/profile/${seller.username}`}
                        className="flex items-center gap-1.5 mt-1.5 text-xs text-foreground-muted hover:text-foreground w-fit">
                        <Avatar src={seller.avatar_url || undefined} alt={seller.username} size={16} />
                        @{seller.username}
                      </Link>
                    )}
                    <p className="text-xs text-foreground-subtle mt-1">
                      {formatDistanceToNow(new Date(item.created_at), { addSuffix: true, locale: faIR })}
                    </p>
                    {item.admin_note && <p className="text-xs text-red-400 mt-1">{item.admin_note}</p>}
                  </div>
                </div>
                {item.status === "active" && <RemoveItemListingForm listingId={item.id} />}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
