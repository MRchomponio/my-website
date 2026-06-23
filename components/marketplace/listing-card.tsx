import Link from "next/link";
import Image from "next/image";
import { Package } from "lucide-react";
import { Card, Avatar } from "@/components/ui/card";
import { formatToman } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface ListingCardProps {
  listing: {
    id: string;
    title: string;
    description: string;
    image_urls: string[];
    price_rials: number;
    created_at: string;
    game: { name: string; accent_color: string } | null;
    seller: { username: string; avatar_url: string | null } | null;
  };
}

export function ListingCard({ listing }: ListingCardProps) {
  const coverImage = listing.image_urls?.[0] ?? null;

  return (
    <Link href={`/marketplace/${listing.id}`}>
      <Card className="overflow-hidden hover:border-neon-blue/40 transition-colors h-full flex flex-col">
        <div className="relative w-full aspect-[4/3] bg-background-elevated">
          {coverImage ? (
            <Image
              src={coverImage}
              alt={listing.title}
              fill
              className="object-cover"
              unoptimized
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Package className="h-8 w-8 text-foreground-subtle" />
            </div>
          )}
          {listing.game && (
            <span
              className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm"
              style={{
                backgroundColor: `${listing.game.accent_color}30`,
                color: listing.game.accent_color,
              }}
            >
              {listing.game.name}
            </span>
          )}
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <p className="font-semibold text-sm line-clamp-2">{listing.title}</p>
          <p className="text-xs text-foreground-muted mt-1 line-clamp-2 flex-1">
            {listing.description}
          </p>
          <div className="flex items-center justify-between mt-3">
            <span className="font-bold">{formatToman(listing.price_rials)} تومان</span>
            {listing.seller && (
              <div className="flex items-center gap-1.5 text-xs text-foreground-subtle">
                <Avatar src={listing.seller.avatar_url} alt={listing.seller.username} size={16} />
                <span>@{listing.seller.username}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-foreground-subtle mt-1.5">
            {formatDistanceToNow(new Date(listing.created_at), { addSuffix: true, locale: faIR })}
          </p>
        </div>
      </Card>
    </Link>
  );
}
