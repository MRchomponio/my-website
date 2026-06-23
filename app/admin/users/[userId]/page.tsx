import { notFound } from "next/navigation";
import Link from "next/link";
import { Avatar, Card, PillBadge } from "@/components/ui/card";
import { TrustScoreBadge } from "@/components/profile/trust-score-badge";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { TagPill } from "@/components/tags/tag-pill";
import { createClient } from "@/lib/supabase/server";
import { ManageUserBadges } from "@/components/admin/manage-user-badges";
import { ManageUserTags } from "@/components/admin/manage-user-tags";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function AdminUserDetailPage({ params }: PageProps) {
  const { userId } = await params;
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const { data: allManualBadges } = await supabase
    .from("badges")
    .select("*")
    .eq("is_manual", true)
    .order("name");

  const { data: userBadgeRows } = await supabase
    .from("user_badges")
    .select("badge_id")
    .eq("user_id", userId);
  const userBadgeIds = new Set(userBadgeRows?.map((b) => b.badge_id) ?? []);

  const { data: allTags } = await supabase.from("tags").select("*").order("name");

  const { data: userTagRows } = await supabase
    .from("user_tags")
    .select("tag_id")
    .eq("user_id", userId);
  const userTagIds = new Set(userTagRows?.map((t) => t.tag_id) ?? []);

  return (
    <div>
      <Link
        href="/admin/users"
        className="text-sm text-foreground-subtle hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← بازگشت به لیست کاربران
      </Link>

      <Card className="p-5 flex items-center gap-4 mb-6">
        <Avatar
          src={profile.avatar_url}
          alt={profile.display_name || profile.username}
          size={56}
        />
        <div className="flex-1 min-w-0">
          <Link
            href={`/profile/${profile.username}`}
            className="font-semibold hover:text-neon-blue-glow transition-colors"
          >
            {profile.display_name || profile.username}
          </Link>
          <p className="text-xs text-foreground-subtle" dir="ltr">
            @{profile.username}
          </p>
        </div>
        <TrustScoreBadge score={profile.trust_score} />
        <PillBadge tone="blue">سطح {profile.level}</PillBadge>
        {profile.is_admin && <PillBadge tone="purple">ادمین</PillBadge>}
      </Card>

      <div className="grid sm:grid-cols-2 gap-5">
        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-4">بج‌های دستی</h2>
          {!allManualBadges || allManualBadges.length === 0 ? (
            <p className="text-xs text-foreground-subtle">
              هنوز هیچ بج دستی‌ای ساخته نشده. اول از{" "}
              <Link href="/admin/badges" className="text-neon-blue-glow hover:underline">
                صفحه بج‌ها
              </Link>{" "}
              یکی بساز.
            </p>
          ) : (
            <ManageUserBadges
              userId={userId}
              badges={allManualBadges}
              assignedBadgeIds={Array.from(userBadgeIds)}
            />
          )}
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold mb-4">تگ‌ها</h2>
          {!allTags || allTags.length === 0 ? (
            <p className="text-xs text-foreground-subtle">
              هنوز هیچ تگی ساخته نشده. اول از{" "}
              <Link href="/admin/tags" className="text-neon-blue-glow hover:underline">
                صفحه تگ‌ها
              </Link>{" "}
              یکی بساز.
            </p>
          ) : (
            <ManageUserTags
              userId={userId}
              tags={allTags}
              assignedTagIds={Array.from(userTagIds)}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
