import { CheckCircle2 } from "lucide-react";
import { Avatar, Card } from "@/components/ui/card";
import { UpvoteButton } from "@/components/forum/upvote-button";
import { AcceptReplyButton } from "@/components/forum/accept-reply-button";
import { ReportButton } from "@/components/reports/report-button";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface Reply {
  id: string;
  body: string;
  upvote_count: number;
  created_at: string;
  author_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

export function ReplyList({
  replies,
  postId,
  postAuthorId,
  acceptedReplyId,
  currentUserId,
  votedReplyIds,
  isLoggedIn,
}: {
  replies: Reply[];
  postId: string;
  postAuthorId: string;
  acceptedReplyId: string | null;
  currentUserId: string | null;
  votedReplyIds: Set<string>;
  isLoggedIn: boolean;
}) {
  const isPostOwner = currentUserId === postAuthorId;

  // Sort: accepted reply first, then by upvotes desc, then oldest first.
  const sorted = [...replies].sort((a, b) => {
    if (a.id === acceptedReplyId) return -1;
    if (b.id === acceptedReplyId) return 1;
    if (b.upvote_count !== a.upvote_count) return b.upvote_count - a.upvote_count;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  if (sorted.length === 0) {
    return (
      <p className="text-sm text-foreground-subtle text-center py-6">
        هنوز پاسخی ثبت نشده. اولین نفری باش که کمک می‌کنه!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((reply) => {
        const isAccepted = reply.id === acceptedReplyId;
        return (
          <Card
            key={reply.id}
            className={
              isAccepted
                ? "p-4 flex gap-3 border-neon-green/40 bg-neon-green/[0.03]"
                : "p-4 flex gap-3"
            }
          >
            <UpvoteButton
              replyId={reply.id}
              initialCount={reply.upvote_count}
              initiallyVoted={votedReplyIds.has(reply.id)}
              isLoggedIn={isLoggedIn}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1.5">
                <Avatar
                  src={reply.profiles?.avatar_url}
                  alt={reply.profiles?.username ?? "?"}
                  size={24}
                />
                <span className="text-sm font-medium">{reply.profiles?.username}</span>
                <span className="text-xs text-foreground-subtle">
                  {formatDistanceToNow(new Date(reply.created_at), {
                    addSuffix: true,
                    locale: faIR,
                  })}
                </span>
                {isAccepted && (
                  <span className="flex items-center gap-1 text-xs text-neon-green-glow font-medium">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    بهترین پاسخ
                  </span>
                )}
                {currentUserId && currentUserId !== reply.author_id && (
                  <ReportButton
                    targetType="reply"
                    targetId={reply.id}
                    targetUserId={reply.author_id}
                  />
                )}
              </div>

              <p className="text-sm text-foreground-muted whitespace-pre-wrap">
                {reply.body}
              </p>

              {isPostOwner && (
                <div className="mt-2.5">
                  <AcceptReplyButton
                    postId={postId}
                    replyId={reply.id}
                    isAccepted={isAccepted}
                  />
                </div>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
