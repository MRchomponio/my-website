import { notFound } from "next/navigation";
import Link from "next/link";
import { Pin, CheckCircle2, Eye } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Avatar, Card, PillBadge } from "@/components/ui/card";
import { ReplyForm } from "@/components/forum/reply-form";
import { ReplyList } from "@/components/forum/reply-list";
import { PinPostButton } from "@/components/forum/pin-post-button";
import { ReportButton } from "@/components/reports/report-button";
import { getCategoryMeta } from "@/lib/post-categories";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface PageProps {
  params: Promise<{ postId: string }>;
}

export default async function PostDetailPage({ params }: PageProps) {
  const { postId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: post } = await supabase
    .from("posts")
    .select(
      "*, games(name, slug, accent_color), profiles!posts_author_id_fkey(id, username, avatar_url, trust_score)"
    )
    .eq("id", postId)
    .maybeSingle();

  if (!post) {
    notFound();
  }

  // Fire-and-forget view count increment. Uses a dedicated RPC
  // (increment_post_view_count, migration 0014) rather than a raw
  // .update() — a raw UPDATE through the admin/service-role client only
  // bypasses RLS, NOT the protect_post_columns_trigger BEFORE UPDATE
  // trigger (migration 0010), which would silently revert view_count
  // back to its old value regardless of which role issued the UPDATE.
  // The RPC works for logged-out visitors too since it requires no
  // auth — matching the original intent.
  try {
    const admin = await createAdminClient();
    await admin.rpc("increment_post_view_count", { p_post_id: postId });
  } catch {
    // Non-critical — view count just won't increment this time.
  }

  const { data: replies } = await supabase
    .from("replies")
    .select("id, body, upvote_count, created_at, author_id, profiles(username, avatar_url)")
    .eq("post_id", postId)
    .order("created_at");

  let votedReplyIds = new Set<string>();
  if (user && replies && replies.length > 0) {
    const { data: votes } = await supabase
      .from("reply_votes")
      .select("reply_id")
      .eq("user_id", user.id)
      .in(
        "reply_id",
        replies.map((r) => r.id)
      );
    votedReplyIds = new Set(votes?.map((v) => v.reply_id) ?? []);
  }

  let isAdmin = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();
    isAdmin = profile?.is_admin ?? false;
  }

  const game = post.games as unknown as {
    name: string;
    slug: string;
    accent_color: string;
  } | null;
  const author = post.profiles as unknown as {
    id: string;
    username: string;
    avatar_url: string | null;
    trust_score: number;
  } | null;

  const categoryMeta = getCategoryMeta(post.category);
  const CategoryIcon = categoryMeta.icon;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        {game && (
          <Link
            href={`/games/${game.slug}`}
            className="inline-flex items-center gap-1.5 text-sm mb-4"
            style={{ color: game.accent_color }}
          >
            ← بازگشت به {game.name}
          </Link>
        )}

        <Card className="p-6">
          <div className="flex items-center gap-2 flex-wrap mb-3">
            {post.is_pinned && (
              <span className="flex items-center gap-1 text-xs text-neon-purple-glow font-medium">
                <Pin className="h-3.5 w-3.5" />
                پین‌شده
              </span>
            )}
            <PillBadge tone={categoryMeta.tone}>
              <CategoryIcon className="h-3 w-3" />
              {categoryMeta.label}
            </PillBadge>
            {post.accepted_reply_id && (
              <PillBadge tone="green">
                <CheckCircle2 className="h-3 w-3" />
                پاسخ داده شده
              </PillBadge>
            )}
            {isAdmin && (
              <PinPostButton postId={post.id} isPinned={post.is_pinned} />
            )}
          </div>

          <h1 className="text-xl font-bold">{post.title}</h1>

          <div className="flex items-center gap-2.5 mt-3">
            <Avatar src={author?.avatar_url} alt={author?.username ?? "?"} size={28} />
            <span className="text-sm font-medium">{author?.username}</span>
            <span className="text-xs text-foreground-subtle">
              {formatDistanceToNow(new Date(post.created_at), {
                addSuffix: true,
                locale: faIR,
              })}
            </span>
            <span className="flex items-center gap-1 text-xs text-foreground-subtle mr-auto">
              <Eye className="h-3.5 w-3.5" />
              {post.view_count + 1}
            </span>
            {user && user.id !== post.author_id && (
              <ReportButton
                targetType="post"
                targetId={post.id}
                targetUserId={post.author_id}
              />
            )}
          </div>

          <p className="text-sm text-foreground-muted mt-4 whitespace-pre-wrap leading-7">
            {post.body}
          </p>
        </Card>

        <div className="mt-6">
          <h2 className="text-sm font-semibold text-foreground-muted mb-3">
            {replies?.length ?? 0} پاسخ
          </h2>
          <ReplyList
            replies={replies ?? []}
            postId={post.id}
            postAuthorId={post.author_id}
            acceptedReplyId={post.accepted_reply_id}
            currentUserId={user?.id ?? null}
            votedReplyIds={votedReplyIds}
            isLoggedIn={Boolean(user)}
          />
        </div>

        <Card className="p-5 mt-5">
          <h3 className="text-sm font-semibold mb-3">پاسخ بده</h3>
          <ReplyForm postId={post.id} isLoggedIn={Boolean(user)} />
        </Card>
      </main>
    </div>
  );
}
