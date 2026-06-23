import Link from "next/link";
import { Flag, FileText, MessageSquare, User, Users } from "lucide-react";
import { Card, PillBadge, Avatar } from "@/components/ui/card";
import { ResolveReportForm } from "@/components/admin/resolve-report-form";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import type { ReportTargetType } from "@/types/database";

const targetTypeMeta: Record<
  ReportTargetType,
  { label: string; icon: typeof FileText }
> = {
  post: { label: "پست", icon: FileText },
  reply: { label: "پاسخ", icon: MessageSquare },
  user: { label: "کاربر", icon: User },
  room: { label: "اتاق", icon: Users },
};

interface TargetPreview {
  label: string;
  href: string | null;
}

export default async function AdminReportsPage() {
  const supabase = await createClient();

  const { data: reports } = await supabase
    .from("reports")
    .select(
      "*, reporter:profiles!reports_reporter_id_fkey(username, avatar_url), target_user:profiles!reports_target_user_id_fkey(username)"
    )
    .order("status", { ascending: true }) // 'invalid' < 'pending' < 'valid' alphabetically isn't ideal, sort client-side instead
    .order("created_at", { ascending: false });

  // Sort so pending reports always show first, regardless of alphabetical
  // enum order — pending needs admin attention, valid/invalid are history.
  const sorted = [...(reports ?? [])].sort((a, b) => {
    if (a.status === "pending" && b.status !== "pending") return -1;
    if (b.status === "pending" && a.status !== "pending") return 1;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  // For each report, fetch a small preview of the actual target content.
  // Done with Promise.all so it's not N sequential round trips.
  const previews = await Promise.all(
    sorted.map(async (report): Promise<TargetPreview> => {
      if (report.target_type === "post") {
        const { data: post } = await supabase
          .from("posts")
          .select("title")
          .eq("id", report.target_id)
          .maybeSingle();
        return {
          label: post?.title ?? "(پست حذف شده)",
          href: post ? `/posts/${report.target_id}` : null,
        };
      }
      if (report.target_type === "reply") {
        const { data: reply } = await supabase
          .from("replies")
          .select("body, post_id")
          .eq("id", report.target_id)
          .maybeSingle();
        return {
          label: reply ? reply.body.slice(0, 60) : "(پاسخ حذف شده)",
          href: reply ? `/posts/${reply.post_id}` : null,
        };
      }
      if (report.target_type === "room") {
        const { data: room } = await supabase
          .from("rooms")
          .select("title")
          .eq("id", report.target_id)
          .maybeSingle();
        return {
          label: room?.title ?? "(اتاق حذف شده)",
          href: room ? `/rooms/${report.target_id}` : null,
        };
      }
      // user
      const targetUser = report.target_user as unknown as { username: string } | null;
      return {
        label: targetUser?.username ?? "(کاربر حذف شده)",
        href: targetUser ? `/profile/${targetUser.username}` : null,
      };
    })
  );

  const pendingCount = sorted.filter((r) => r.status === "pending").length;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">گزارش‌ها</h1>
        <p className="text-sm text-foreground-muted mt-1">
          {pendingCount > 0
            ? `${pendingCount} گزارش در انتظار بررسی`
            : "هیچ گزارش در انتظار بررسی‌ای نیست"}
        </p>
      </div>

      {sorted.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          <Flag className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
          هنوز هیچ گزارشی ثبت نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {sorted.map((report, i) => {
            const meta = targetTypeMeta[report.target_type];
            const TargetIcon = meta.icon;
            const reporter = report.reporter as unknown as {
              username: string;
              avatar_url: string | null;
            } | null;
            const preview = previews[i];

            return (
              <Card
                key={report.id}
                className={
                  report.status === "pending"
                    ? "p-4 border-neon-blue/30"
                    : "p-4 opacity-70"
                }
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <PillBadge tone="neutral">
                      <TargetIcon className="h-3 w-3" />
                      {meta.label}
                    </PillBadge>
                    {report.status === "pending" && (
                      <PillBadge tone="blue">در انتظار بررسی</PillBadge>
                    )}
                    {report.status === "valid" && (
                      <PillBadge tone="green">معتبر تایید شد (-{report.trust_penalty})</PillBadge>
                    )}
                    {report.status === "invalid" && (
                      <PillBadge tone="red">نامعتبر اعلام شد</PillBadge>
                    )}
                  </div>
                  <span className="text-xs text-foreground-subtle">
                    {formatDistanceToNow(new Date(report.created_at), {
                      addSuffix: true,
                      locale: faIR,
                    })}
                  </span>
                </div>

                <div className="mt-3">
                  {preview.href ? (
                    <Link
                      href={preview.href}
                      className="text-sm font-medium text-neon-blue-glow hover:underline"
                    >
                      {preview.label}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium text-foreground-subtle">
                      {preview.label}
                    </p>
                  )}
                </div>

                <p className="text-sm text-foreground-muted mt-2 whitespace-pre-wrap">
                  {report.reason}
                </p>

                <div className="flex items-center gap-2 mt-3">
                  <Avatar
                    src={reporter?.avatar_url}
                    alt={reporter?.username ?? "?"}
                    size={20}
                  />
                  <span className="text-xs text-foreground-subtle">
                    گزارش‌دهنده: {reporter?.username}
                  </span>
                </div>

                {report.status === "pending" && (
                  <ResolveReportForm reportId={report.id} />
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
