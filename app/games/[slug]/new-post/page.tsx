import { notFound, redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { PostForm } from "@/components/forum/post-form";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function NewPostPage({ params }: PageProps) {
  const { slug } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirectTo=/games/${slug}/new-post`);
  }

  const { data: game } = await supabase
    .from("games")
    .select("id, name, slug, accent_color")
    .eq("slug", slug)
    .maybeSingle();

  if (!game) {
    notFound();
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">پست جدید در {game.name}</h1>
        <p className="text-sm text-foreground-muted mb-6">
          سوالت رو بپرس، راهنما بنویس، یا یه بحث شروع کن.
        </p>
        <Card className="p-6 sm:p-7">
          <PostForm gameId={game.id} gameSlug={game.slug} />
        </Card>
      </main>
    </div>
  );
}
