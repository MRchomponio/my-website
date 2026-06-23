import Link from "next/link";
import { Avatar, Card, PillBadge } from "@/components/ui/card";
import { TrustScoreBadge } from "@/components/profile/trust-score-badge";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function AdminUsersPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, trust_score, level, is_admin")
    .order("created_at", { ascending: false })
    .limit(50);

  if (q?.trim()) {
    query = query.ilike("username", `%${q.trim()}%`);
  }

  const { data: users } = await query;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">کاربران</h1>
        <p className="text-sm text-foreground-muted mt-1">
          مدیریت کاربران، تخصیص بج و تگ.
        </p>
      </div>

      <form className="mb-5">
        <input
          type="text"
          name="q"
          defaultValue={q ?? ""}
          placeholder="جستجوی نام کاربری..."
          className="w-full max-w-sm h-10 rounded-xl bg-background-elevated border border-background-border px-3.5 text-sm outline-none focus:border-neon-blue/60"
        />
      </form>

      {!users || users.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          کاربری پیدا نشد.
        </Card>
      ) : (
        <div className="space-y-2.5">
          {users.map((user) => (
            <Link key={user.id} href={`/admin/users/${user.id}`}>
              <Card className="p-3.5 flex items-center gap-3 hover:border-neon-blue/40 transition-colors">
                <Avatar
                  src={user.avatar_url}
                  alt={user.display_name || user.username}
                  size={36}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.display_name || user.username}
                  </p>
                  <p className="text-xs text-foreground-subtle truncate" dir="ltr">
                    @{user.username}
                  </p>
                </div>
                <TrustScoreBadge score={user.trust_score} size="sm" />
                <PillBadge tone="blue">سطح {user.level}</PillBadge>
                {user.is_admin && <PillBadge tone="purple">ادمین</PillBadge>}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
