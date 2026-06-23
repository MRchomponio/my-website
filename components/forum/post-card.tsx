import Link from "next/link";
import { Pin, MessageSquare, Eye, CheckCircle2 } from "lucide-react";
import { Avatar, Card, PillBadge } from "@/components/ui/card";
import { getCategoryMeta } from "@/lib/post-categories";
import type { PostCategory } from "@/types/database";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface PostCardProps {
  id: string;
  title: string;
  category: PostCategory;
  isPinned: boolean;
  hasAcceptedReply: boolean;
  replyCount: number;
  viewCount: number;
  createdAt: string;
  author: { username: string; avatar_url: string | null } | null;
  showGameBadge?: { name: string; accent_color: string } | null;
}

export function PostCard({
  id,
  title,
  category,
  isPinned,
  hasAcceptedReply,
  replyCount,
  viewCount,
  createdAt,
  author,
  showGameBadge,
}: PostCardProps) {
  const categoryMeta = getCategoryMeta(category);
  const CategoryIcon = categoryMeta.icon;

  return (
    <Link href={`/posts/${id}`}>
      <Card className="p-4 hover:border-neon-blue/40 transition-colors flex items-start gap-3">
        <Avatar src={author?.avatar_url} alt={author?.username ?? "?"} size={38} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            {isPinned && <Pin className="h-3.5 w-3.5 text-neon-purple-glow shrink-0" />}
            <h3 className="font-semibold truncate">{title}</h3>
            {hasAcceptedReply && (
              <CheckCircle2 className="h-4 w-4 text-neon-green-glow shrink-0" />
            )}
          </div>

          <div className="flex items-center gap-2 mt-1.5 flex-wrap text-xs text-foreground-subtle">
            <span>{author?.username}</span>
            <span>·</span>
            <span>
              {formatDistanceToNow(new Date(createdAt), {
                addSuffix: true,
                locale: faIR,
              })}
            </span>
            {showGameBadge && (
              <>
                <span>·</span>
                <span style={{ color: showGameBadge.accent_color }}>
                  {showGameBadge.name}
                </span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 mt-2.5">
            <PillBadge tone={categoryMeta.tone}>
              <CategoryIcon className="h-3 w-3" />
              {categoryMeta.label}
            </PillBadge>
            <span className="flex items-center gap-1 text-xs text-foreground-subtle">
              <MessageSquare className="h-3.5 w-3.5" />
              {replyCount}
            </span>
            <span className="flex items-center gap-1 text-xs text-foreground-subtle">
              <Eye className="h-3.5 w-3.5" />
              {viewCount}
            </span>
          </div>
        </div>
      </Card>
    </Link>
  );
}
