import Link from "next/link";
import Image from "next/image";
import { Users, Swords, Coffee } from "lucide-react";
import { Card, PillBadge, Avatar } from "@/components/ui/card";

interface RoomCardProps {
  id: string;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  mode: "casual" | "competitive";
  maxPlayers: number;
  memberCount: number;
  status: "open" | "full" | "closed";
  game: { name: string; slug: string; accent_color: string; icon_url: string | null } | null;
  host: { username: string; avatar_url: string | null } | null;
}

export function RoomCard({
  id,
  title,
  description,
  bannerUrl,
  mode,
  maxPlayers,
  memberCount,
  status,
  game,
  host,
}: RoomCardProps) {
  const accent = game?.accent_color ?? "#3b82f6";

  return (
    <Link href={`/rooms/${id}`}>
      <Card className="overflow-hidden hover:border-neon-blue/40 transition-colors h-full flex flex-col">
        <div
          className="h-24 relative bg-cover bg-center"
          style={{
            backgroundColor: `${accent}22`,
            backgroundImage: bannerUrl ? `url(${bannerUrl})` : undefined,
          }}
        >
          {game && (
            <span
              className="absolute bottom-2 right-2 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-2.5 py-1 text-xs font-medium text-white"
            >
              {game.icon_url && (
                <Image
                  src={game.icon_url}
                  alt={game.name}
                  width={16}
                  height={16}
                  className="rounded-full"
                  unoptimized
                />
              )}
              {game.name}
            </span>
          )}
          {status === "full" && (
            <span className="absolute top-2 left-2 rounded-full bg-red-500/80 px-2 py-0.5 text-[11px] font-medium text-white">
              پر شده
            </span>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <h3 className="font-semibold truncate">{title}</h3>
          {description && (
            <p className="text-xs text-foreground-muted mt-1 line-clamp-2 flex-1">
              {description}
            </p>
          )}

          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {host && (
                <Avatar src={host.avatar_url} alt={host.username} size={22} />
              )}
              <span className="text-xs text-foreground-subtle truncate max-w-[100px]">
                {host?.username}
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <PillBadge tone={mode === "competitive" ? "purple" : "green"}>
                {mode === "competitive" ? (
                  <Swords className="h-3 w-3" />
                ) : (
                  <Coffee className="h-3 w-3" />
                )}
                {mode === "competitive" ? "رقابتی" : "رفاقتی"}
              </PillBadge>
              <PillBadge tone="neutral">
                <Users className="h-3 w-3" />
                {memberCount}/{maxPlayers}
              </PillBadge>
            </div>
          </div>
        </div>
      </Card>
    </Link>
  );
}
