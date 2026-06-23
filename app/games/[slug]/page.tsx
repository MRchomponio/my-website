import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { Suspense } from "react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/forum/post-card";
import { PostFilters } from "@/components/forum/post-filters";
import { FavoriteGameButton } from "@/components/forum/favorite-game-button";
import { createClient } from "@/lib/supabase/server";
import type { PostCategory } from "@/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ category?: string; q?: string }>;
}

export default async function GamePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { category, q } = await searchParams;
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();

  if (!game) {
    notFound();
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isFavorited = false;
  if (user) {
    const { data: fav } = await supabase
      .from("favorites")
      .select("user_id")
      .eq("user_id", user.id)
      .eq("game_id", game.id)
      .maybeSingle();
    isFavorited = Boolean(fav);
  }

  let query = supabase
    .from("posts")
    .select("id, title, category, is_pinned, accepted_reply_id, reply_count, view_count, created_at, profiles(username, avatar_url)")
    .eq("game_id", game.id)
    .order("is_pinned", { ascending: false })
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category as PostCategory);
  }
  if (q) {
    query = query.textSearch("search_vector", q, { type: "websearch", config: "simple" });
  }

  const { data: posts } = await query;

  return (
    <div className="min-h-screen">
      <Navbar />

      <div
        className="h-40 sm:h-52 relative bg-cover bg-center"
        style={{
          backgroundColor: `${game.accent_color}25`,
          backgroundImage: game.banner_url ? `url(${game.banner_url})` : undefined,
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
      </div>

      <main className="max-w-3xl mx-auto px-4 -mt-12 relative pb-8">
        <div className="flex items-end gap-4 mb-6">
          <div
            className="w-20 h-20 rounded-2xl overflow-hidden border-4 border-background relative shrink-0 bg-background-elevated"
          >
            {game.icon_url ? (
              <Image src={game.icon_url} alt={game.name} fill className="object-cover" unoptimized />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-2xl font-bold"
                style={{ backgroundColor: `${game.accent_color}30`, color: game.accent_color }}
              >
                {game.name[0]}
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-2xl font-bold">{game.name}</h1>
            {game.description && (
              <p className="text-sm text-foreground-muted mt-0.5 truncate">
                {game.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 pb-1">
            <FavoriteGameButton
              gameId={game.id}
              isFavorited={isFavorited}
              isLoggedIn={Boolean(user)}
            />
            <Link href={`/games/${game.slug}/new-post`}>
              <Button size="sm">
                <Plus className="h-4 w-4" />
                پست جدید
              </Button>
            </Link>
          </div>
        </div>

        <Suspense fallback={<div className="h-10 rounded-xl bg-background-elevated animate-pulse" />}>
          <PostFilters />
        </Suspense>

        <div className="space-y-3 mt-5">
          {!posts || posts.length === 0 ? (
            <Card className="p-10 text-center text-foreground-muted">
              هنوز پستی تو این بازی ثبت نشده. اولین نفری باش که سوال می‌پرسه
              یا راهنما می‌نویسه!
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
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}
