import Image from "next/image";
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, PillBadge } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { CloseRoomButton } from "@/components/admin/close-room-button";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

export default async function AdminRoomsPage() {
  const supabase = await createClient();

  const { data: rooms } = await supabase
    .from("rooms")
    .select(
      "id, title, status, mode, max_players, created_at, games(name, accent_color, icon_url), profiles!rooms_host_id_fkey(username), room_members(user_id)"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">اتاق‌ها</h1>
        <p className="text-sm text-foreground-muted mt-1">
          نظارت بر اتاق‌های LFG و بستن اتاق‌های نامناسب.
        </p>
      </div>

      {!rooms || rooms.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          هنوز هیچ اتاقی ساخته نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {rooms.map((room) => {
            const game = room.games as unknown as {
              name: string;
              accent_color: string;
              icon_url: string | null;
            } | null;
            const host = room.profiles as unknown as { username: string } | null;
            const memberCount = Array.isArray(room.room_members)
              ? room.room_members.length
              : 0;

            return (
              <Card key={room.id} className="p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0 bg-background-elevated">
                  {game?.icon_url ? (
                    <Image
                      src={game.icon_url}
                      alt={game.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div
                      className="w-full h-full flex items-center justify-center text-sm font-bold"
                      style={{
                        backgroundColor: `${game?.accent_color ?? "#3b82f6"}30`,
                        color: game?.accent_color ?? "#3b82f6",
                      }}
                    >
                      {game?.name?.[0] ?? "?"}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <Link
                    href={`/rooms/${room.id}`}
                    className="font-medium truncate hover:text-neon-blue-glow transition-colors"
                  >
                    {room.title}
                  </Link>
                  <p className="text-xs text-foreground-subtle mt-0.5">
                    میزبان: {host?.username} ·{" "}
                    {formatDistanceToNow(new Date(room.created_at), {
                      addSuffix: true,
                      locale: faIR,
                    })}
                  </p>
                </div>

                <PillBadge tone="neutral">
                  <Users className="h-3 w-3" />
                  {memberCount}/{room.max_players}
                </PillBadge>

                <PillBadge
                  tone={
                    room.status === "open"
                      ? "green"
                      : room.status === "full"
                      ? "blue"
                      : "red"
                  }
                >
                  {room.status === "open"
                    ? "باز"
                    : room.status === "full"
                    ? "پر شده"
                    : "بسته‌شده"}
                </PillBadge>

                {room.status !== "closed" && (
                  <CloseRoomButton roomId={room.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
