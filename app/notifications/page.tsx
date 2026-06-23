import { Bell } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { NotificationItem } from "@/components/notifications/notification-item";
import { MarkAllReadButton } from "@/components/notifications/mark-all-read-button";
import { requireUser } from "@/lib/auth-helpers";

export default async function NotificationsPage() {
  const { profile, supabase } = await requireUser();

  const { data: notifications } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const hasUnread = notifications?.some((n) => !n.is_read) ?? false;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl font-bold">اعلان‌ها</h1>
          {hasUnread && <MarkAllReadButton userId={profile.id} />}
        </div>

        {!notifications || notifications.length === 0 ? (
          <Card className="p-10 text-center text-foreground-muted">
            <Bell className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
            هنوز هیچ اعلانی نداری.
          </Card>
        ) : (
          <div className="space-y-2.5">
            {notifications.map((n) => (
              <NotificationItem
                key={n.id}
                id={n.id}
                type={n.type}
                payload={n.payload}
                isRead={n.is_read}
                createdAt={n.created_at}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
