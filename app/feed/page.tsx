import Link from "next/link";
import Image from "next/image";
import { Compass, Plus } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/forum/post-card";
import { createClient } from "@/lib/supabase/server";

export default async function FeedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: favoriteGames } = user
    ? await supabase
        .from("favorites")
        .select("game_id, games(id, name, slug, accent_color, icon_url)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const gameIds =
    favoriteGames
      ?.map((f) => f.game_id)
      .filter((id): id is string => Boolean(id)) ?? [];

  const { data: posts } =
    gameIds.length > 0
      ? await supabase
          .from("posts")
          .select(
            "id, title, category, is_pinned, accepted_reply_id, reply_count, view_count, created_at, profiles(username, avatar_url), games(name, accent_color)"
          )
          .in("game_id", gameIds)
          .order("created_at", { ascending: false })
          .limit(30)
      : { data: null };

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">فید شما</h1>
        <p className="text-foreground-muted text-sm mb-6">
          پست‌های بازی‌هایی که دنبال می‌کنید.
        </p>

        {!favoriteGames || favoriteGames.length === 0 ? (
          <Card className="p-8 text-center">
            <Compass className="h-8 w-8 text-foreground-subtle mx-auto mb-3" />
            <p className="text-foreground-muted mb-4">
              هنوز هیچ بازی‌ای رو دنبال نکردی. وارد صفحه‌ی یه بازی شو و دکمه‌ی
              «دنبال کردن» رو بزن تا پست‌هاش اینجا نمایش داده بشه.
            </p>
            <Link href="/games">
              <Button variant="secondary" size="sm">
                مرور همه بازی‌ها
              </Button>
            </Link>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-[1fr_260px] gap-6 items-start">
            <div className="space-y-3 order-2 lg:order-1">
              {!posts || posts.length === 0 ? (
                <Card className="p-8 text-center text-foreground-muted">
                  هنوز پستی تو بازی‌های دنبال‌شده‌ت ثبت نشده.
                </Card>
              ) : (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    id={post.id}
                    title={post.title}
                    category={post.category}
                    isPinned={post.is_pinned}
                    hasAcceptedReply={Boolean(post.accepted_reply_id)}
                    replyCount={post.reply_count}
                    viewCount={post.view_count}
                    createdAt={post.created_at}
                    author={
                      post.profiles as unknown as {
                        username: string;
                        avatar_url: string | null;
                      } | null
                    }
                    showGameBadge={
                      post.games as unknown as {
                        name: string;
                        accent_color: string;
                      } | null
                    }
                  />
                ))
              )}
            </div>

            <aside className="order-1 lg:order-2">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold text-foreground-muted">
                  بازی‌های دنبال‌شده
                </h2>
                <Link
                  href="/games"
                  className="text-foreground-subtle hover:text-neon-blue-glow transition-colors"
                  title="افزودن بازی جدید"
                >
                  <Plus className="h-4 w-4" />
                </Link>
              </div>
              <Card className="divide-y divide-background-border overflow-hidden">
                {favoriteGames.map((f) => {
                  const game = f.games as unknown as {
                    id: string;
                    name: string;
                    slug: string;
                    accent_color: string;
                    icon_url: string | null;
                  } | null;
                  if (!game) return null;
                  return (
                    <Link
                      key={game.id}
                      href={`/games/${game.slug}`}
                      className="flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-background-elevated transition-colors"
                    >
                      <div className="w-7 h-7 rounded-lg overflow-hidden relative shrink-0 bg-background-elevated">
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
                            className="w-full h-full flex items-center justify-center text-xs font-bold"
                            style={{
                              backgroundColor: `${game.accent_color}30`,
                              color: game.accent_color,
                            }}
                          >
                            {game.name[0]}
                          </div>
                        )}
                      </div>
                      <span className="text-sm truncate">{game.name}</span>
                    </Link>
                  );
                })}
              </Card>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
