import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function GamesIndexPage() {
  const supabase = await createClient();
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .order("name");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">همه بازی‌ها</h1>
        <p className="text-sm text-foreground-muted mb-6">
          انجمن هر بازی رو ببین، سوال بپرس یا راهنما پیدا کن.
        </p>

        {!games || games.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">
            هنوز هیچ بازی‌ای اضافه نشده.
          </Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {games.map((game) => (
              <Link key={game.id} href={`/games/${game.slug}`}>
                <Card className="overflow-hidden hover:border-neon-blue/40 transition-colors h-full">
                  <div
                    className="h-24 relative bg-cover bg-center"
                    style={{
                      backgroundColor: `${game.accent_color}25`,
                      backgroundImage: game.banner_url
                        ? `url(${game.banner_url})`
                        : undefined,
                    }}
                  />
                  <div className="p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl overflow-hidden relative shrink-0 bg-background-elevated">
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
                          className="w-full h-full flex items-center justify-center text-sm font-bold"
                          style={{
                            backgroundColor: `${game.accent_color}30`,
                            color: game.accent_color,
                          }}
                        >
                          {game.name[0]}
                        </div>
                      )}
                    </div>
                    <span className="font-medium">{game.name}</span>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
