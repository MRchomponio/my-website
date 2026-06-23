import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";
import { DeleteGameButton } from "@/components/admin/delete-game-button";

// تعریف نوع Game
type Game = {
  id: string;
  name: string;
  slug: string;
  accent_color: string | null;
  icon_url: string | null;
  banner_url: string | null;
  description: string | null;
  created_at: string;
};

export default async function AdminGamesPage() {
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });

  // استفاده از as any برای عبور از خطاهای TypeScript
  const typedGames = (games as any[]) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">بازی‌ها</h1>
          <p className="text-sm text-foreground-muted mt-1">
            بازی‌های موجود در پلتفرم رو مدیریت کن.
          </p>
        </div>
        <Link href="/admin/games/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            افزودن بازی
          </Button>
        </Link>
      </div>

      {typedGames.length === 0 ? (
        <Card className="p-8 text-center text-foreground-muted">
          هنوز هیچ بازی‌ای اضافه نشده. اولین بازی رو اضافه کن.
        </Card>
      ) : (
        <div className="space-y-3">
          {typedGames.map((game: any) => (
            <Card key={game.id} className="p-4 flex items-center gap-4">
              <div
                className="w-14 h-14 rounded-xl shrink-0 relative overflow-hidden border"
                style={{ borderColor: `${game.accent_color ?? "#e5e7eb"}50` }}
              >
                {game.icon_url ? (
                  <Image
                    src={game.icon_url}
                    alt={game.name}
                    fill
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center text-lg font-bold"
                    style={{
                      backgroundColor: `${game.accent_color ?? "#e5e7eb"}20`,
                      color: game.accent_color ?? "#e5e7eb",
                    }}
                  >
                    {game.name?.[0] || "?"}
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{game.name}</p>
                <p className="text-xs text-foreground-subtle truncate" dir="ltr">
                  /{game.slug}
                </p>
              </div>

              <span
                className="w-5 h-5 rounded-full border border-background-border shrink-0"
                style={{ backgroundColor: game.accent_color ?? "#e5e7eb" }}
                title={game.accent_color ?? "#e5e7eb"}
              />

              <Link href={`/admin/games/${game.id}/edit`}>
                <Button variant="secondary" size="sm">
                  <Pencil className="h-3.5 w-3.5" />
                  ویرایش
                </Button>
              </Link>

              <DeleteGameButton gameId={game.id} gameName={game.name} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
