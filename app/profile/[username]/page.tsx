import { notFound } from "next/navigation";
import Link from "next/link";
import { Monitor, Gamepad, Smartphone, Joystick, Calendar } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Avatar, Card, PillBadge } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TrustScoreBadge } from "@/components/profile/trust-score-badge";
import { XpProgress } from "@/components/profile/xp-progress";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { TagPill } from "@/components/tags/tag-pill";
import { ReportButton } from "@/components/reports/report-button";
import { createClient } from "@/lib/supabase/server";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

const platformIcons = {
  pc: Monitor,
  playstation: Gamepad,
  xbox: Joystick,
  mobile: Smartphone,
} as const;

const platformLabels = {
  pc: "پی‌سی",
  playstation: "پلی‌استیشن",
  xbox: "ایکس‌باکس",
  mobile: "موبایل",
} as const;

const playStyleLabels = {
  casual: "رفاقتی",
  competitive: "رقابتی",
} as const;

interface PageProps {
  params: Promise<{ username: string }>;
}

export default async function ProfilePage({ params }: PageProps) {
  const { username } = await params;
  const supabase = await createClient();

  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();

  if (!profile) {
    notFound();
  }

  const isOwnProfile = currentUser?.id === profile.id;
  const isOnline =
    Date.now() - new Date(profile.last_seen_at).getTime() < 5 * 60 * 1000;

  const PlatformIcon = profile.platform ? platformIcons[profile.platform] : null;

  const { data: favoriteGames } = await supabase
    .from("favorites")
    .select("games(id, name, slug, accent_color, icon_url)")
    .eq("user_id", profile.id);

  const { data: trustLogs } = isOwnProfile
    ? await supabase
        .from("trust_score_logs")
        .select("id, delta, reason, created_at")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(10)
    : { data: null };

  const { data: userBadges } = await supabase
    .from("user_badges")
    .select("earned_at, badges(name, description, icon)")
    .eq("user_id", profile.id)
    .order("earned_at", { ascending: false });

  const { data: userTags } = await supabase
    .from("user_tags")
    .select("tags(id, name, description, color)")
    .eq("user_id", profile.id);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-col sm:flex-row sm:items-start gap-5">
            <Avatar
              src={profile.avatar_url}
              alt={profile.display_name ?? profile.username}
              size={88}
              online={isOnline}
            />
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl font-bold">
                  {profile.display_name || profile.username}
                </h1>
                <span className="text-foreground-subtle text-sm" dir="ltr">
                  @{profile.username}
                </span>
                {profile.is_admin && <PillBadge tone="purple">ادمین</PillBadge>}
                {userTags?.map((ut) => {
                  const tag = ut.tags as unknown as {
                    id: string;
                    name: string;
                    description: string;
                    color: string;
                  } | null;
                  if (!tag) return null;
                  return (
                    <TagPill
                      key={tag.id}
                      name={tag.name}
                      color={tag.color}
                      description={tag.description}
                      size="sm"
                    />
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                <TrustScoreBadge score={profile.trust_score} size="sm" />
                <PillBadge tone="blue">سطح {profile.level}</PillBadge>
                {profile.play_style && (
                  <PillBadge tone="neutral">
                    {playStyleLabels[profile.play_style]}
                  </PillBadge>
                )}
                {PlatformIcon && (
                  <PillBadge tone="neutral">
                    <PlatformIcon className="h-3 w-3" />
                    <span>{platformLabels[profile.platform!]}</span>
                  </PillBadge>
                )}
              </div>

              {profile.bio && (
                <p className="text-sm text-foreground-muted mt-3 whitespace-pre-wrap">
                  {profile.bio}
                </p>
              )}

              <div className="mt-3.5 max-w-xs">
                <XpProgress xp={profile.xp} level={profile.level} />
              </div>

              <div className="flex items-center gap-1.5 text-xs text-foreground-subtle mt-3">
                <Calendar className="h-3.5 w-3.5" />
                عضویت از{" "}
                {formatDistanceToNow(new Date(profile.created_at), {
                  addSuffix: true,
                  locale: faIR,
                })}
              </div>
            </div>

            {isOwnProfile ? (
              <Link href="/settings/profile">
                <Button variant="secondary" size="sm">
                  ویرایش پروفایل
                </Button>
              </Link>
            ) : (
              currentUser && (
                <ReportButton
                  targetType="user"
                  targetId={profile.id}
                  targetUserId={profile.id}
                  variant="full"
                />
              )
            )}
          </div>
        </Card>

        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold">{profile.xp}</p>
            <p className="text-xs text-foreground-muted mt-1">امتیاز تجربه</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold">{favoriteGames?.length ?? 0}</p>
            <p className="text-xs text-foreground-muted mt-1">بازی دنبال‌شده</p>
          </Card>
          <Card className="p-5 text-center">
            <p className="text-2xl font-bold">{profile.trust_score}/۱۰۰</p>
            <p className="text-xs text-foreground-muted mt-1">امتیاز اعتماد</p>
          </Card>
        </div>

        {favoriteGames && favoriteGames.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground-muted mb-3">
              بازی‌های مورد علاقه
            </h2>
            <div className="flex flex-wrap gap-2">
              {favoriteGames.map((f) => {
                const game = f.games as unknown as {
                  id: string;
                  name: string;
                  slug: string;
                  accent_color: string;
                } | null;
                if (!game) return null;
                return (
                  <Link key={game.id} href={`/games/${game.slug}`}>
                    <span
                      className="inline-flex items-center px-3 py-1.5 rounded-full text-sm border"
                      style={{
                        borderColor: `${game.accent_color}50`,
                        color: game.accent_color,
                        backgroundColor: `${game.accent_color}14`,
                      }}
                    >
                      {game.name}
                    </span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {userBadges && userBadges.length > 0 && (
          <div className="mt-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-foreground-muted">
                بج‌ها
              </h2>
              <Link
                href="/badges"
                className="text-xs text-neon-blue-glow hover:underline"
              >
                مشاهده همه بج‌ها
              </Link>
            </div>
            <div className="flex flex-wrap gap-3">
              {userBadges.map((ub) => {
                const badge = ub.badges as unknown as {
                  name: string;
                  description: string;
                  icon: string;
                } | null;
                if (!badge) return null;
                return (
                  <BadgeIcon
                    key={badge.name}
                    name={badge.name}
                    description={badge.description}
                    icon={badge.icon}
                  />
                );
              })}
            </div>
          </div>
        )}

        {trustLogs && trustLogs.length > 0 && (
          <div className="mt-6">
            <h2 className="text-sm font-semibold text-foreground-muted mb-3">
              تاریخچه‌ی امتیاز اعتماد
            </h2>
            <Card className="divide-y divide-background-border">
              {trustLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{log.reason}</p>
                    <p className="text-xs text-foreground-subtle mt-0.5">
                      {formatDistanceToNow(new Date(log.created_at), {
                        addSuffix: true,
                        locale: faIR,
                      })}
                    </p>
                  </div>
                  <span
                    className={
                      log.delta >= 0
                        ? "text-sm font-semibold text-neon-green-glow shrink-0"
                        : "text-sm font-semibold text-red-400 shrink-0"
                    }
                  >
                    {log.delta >= 0 ? `+${log.delta}` : log.delta}
                  </span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
