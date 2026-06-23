import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { createClient } from "@/lib/supabase/server";
import { ManualBadgeForm } from "@/components/admin/manual-badge-form";
import { DeleteBadgeButton } from "@/components/admin/delete-badge-button";

// تعریف نوع برای Badge
type Badge = {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  is_manual: boolean;
  created_at?: string;
};

export default async function AdminBadgesPage() {
  const supabase = await createClient();
  const { data: badges } = await supabase
    .from("badges")
    .select("*")
    .order("name");

  // استفاده از نوع Badge با تبدیل نوع
  const typedBadges = (badges as Badge[]) ?? [];

  const automaticBadges = typedBadges.filter((b) => !b.is_manual);
  const manualBadges = typedBadges.filter((b) => b.is_manual);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold">بج‌ها</h1>
        <p className="text-sm text-foreground-muted mt-1">
          بج‌های دستی که می‌تونی به کاربرها اختصاص بدی رو مدیریت کن.
        </p>
      </div>

      <div className="grid lg:grid-cols-[1fr_320px] gap-6">
        <div className="space-y-6 order-2 lg:order-1">
          <div>
            <h2 className="text-sm font-semibold text-foreground-muted mb-3">
              بج‌های دستی ({manualBadges.length})
            </h2>
            {manualBadges.length === 0 ? (
              <Card className="p-8 text-center text-foreground-muted">
                هنوز هیچ بج دستی‌ای ساخته نشده.
              </Card>
            ) : (
              <div className="space-y-3">
                {manualBadges.map((badge) => (
                  <Card key={badge.id} className="p-4 flex items-center gap-4">
                    <BadgeIcon
                      name={badge.name}
                      description={badge.description ?? ""}
                      icon={badge.icon ?? ""} // ⬅️ تغییر: به جای undefined، یک رشته خالی
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{badge.name}</p>
                      <p className="text-xs text-foreground-subtle truncate">
                        {badge.description ?? "بدون توضیحات"}
                      </p>
                    </div>
                    <DeleteBadgeButton badgeId={badge.id} badgeName={badge.name} />
                  </Card>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground-muted mb-3">
              بج‌های خودکار ({automaticBadges.length})
            </h2>
            <p className="text-xs text-foreground-subtle mb-3">
              این بج‌ها بر اساس فعالیت کاربر خودکار اعطا میشن و قابل ساخت/حذف
              دستی نیستن.
            </p>
            <div className="space-y-3">
              {automaticBadges.map((badge) => (
                <Card key={badge.id} className="p-4 flex items-center gap-4 opacity-70">
                  <BadgeIcon
                    name={badge.name}
                    description={badge.description ?? ""}
                    icon={badge.icon ?? ""} // ⬅️ تغییر: به جای undefined، یک رشته خالی
                    size="sm"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{badge.name}</p>
                    <p className="text-xs text-foreground-subtle truncate">
                      {badge.description ?? "بدون توضیحات"}
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>

        <div className="order-1 lg:order-2">
          <Card className="p-5">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold mb-4">
              <Plus className="h-4 w-4" />
              بج دستی جدید
            </h2>
            <ManualBadgeForm />
          </Card>
        </div>
      </div>
    </div>
  );
}
