import Link from "next/link";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RoomCard } from "@/components/rooms/room-card";
import { createClient } from "@/lib/supabase/server";
import { RoomFilters } from "@/components/rooms/room-filters";

interface SearchParams {
  game?: string;
  mode?: string;
}

export default async function RoomsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { game: gameSlug, mode } = await searchParams;
  const supabase = await createClient();

  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug, accent_color")
    .order("name");

  let query = supabase
    .from("rooms")
    .select(
      "id, title, description, banner_url, mode, max_players, status, games(name, slug, accent_color, icon_url), profiles!rooms_host_id_fkey(username, avatar_url), room_members(user_id)"
    )
    .neq("status", "closed")
    .order("created_at", { ascending: false });

  if (gameSlug) {
    const game = games?.find((g) => g.slug === gameSlug);
    if (game) {
      query = query.eq("game_id", game.id);
    }
  }

  if (mode === "casual" || mode === "competitive") {
    query = query.eq("mode", mode);
  }

  const { data: rooms } = await query;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold">پیدا کردن هم‌تیمی</h1>
            <p className="text-sm text-foreground-muted mt-1">
              یه اتاق بساز یا به یکی از اتاق‌های باز بپیوند.
            </p>
          </div>
          <Link href="/rooms/new">
            <Button size="sm">
              <Plus className="h-4 w-4" />
              ساخت اتاق
            </Button>
          </Link>
        </div>

        <Suspense fallback={<div className="h-12 rounded-xl bg-background-elevated animate-pulse" />}>
          <RoomFilters games={games ?? []} />
        </Suspense>

        {!rooms || rooms.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted mt-6">
            هیچ اتاق بازی پیدا نشد. اولین نفری باش که اتاق می‌سازه!
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
            {rooms.map((room) => (
              <RoomCard
                key={room.id}
                id={room.id}
                title={room.title}
                description={room.description}
                bannerUrl={room.banner_url}
                mode={room.mode}
                maxPlayers={room.max_players}
                status={room.status}
                memberCount={
                  Array.isArray(room.room_members) ? room.room_members.length : 0
                }
                game={
                  room.games as unknown as {
                    name: string;
                    slug: string;
                    accent_color: string;
                    icon_url: string | null;
                  } | null
                }
                host={
                  room.profiles as unknown as {
                    username: string;
                    avatar_url: string | null;
                  } | null
                }
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
