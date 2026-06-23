import { Card } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth-helpers";
import { CommissionSettingForm } from "@/components/admin/commission-setting-form";

export default async function AdminSettingsPage() {
  const { supabase } = await requireAdmin();

  const { data: setting } = await supabase
    .from("site_settings")
    .select("value")
    .eq("key", "marketplace_commission_percent")
    .maybeSingle();

  const currentCommission = Number(setting?.value ?? 5);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">تنظیمات سایت</h1>
      <p className="text-sm text-foreground-muted mb-6">تنظیمات کلی مارکت‌پلیس.</p>

      <Card className="p-5 max-w-sm">
        <h2 className="font-semibold mb-3">درصد کمیسیون مارکت‌پلیس</h2>
        <p className="text-xs text-foreground-subtle mb-4">
          این مقدار از هر فروش اکانت کسر میشه. بقیه به فروشنده می‌رسه.
        </p>
        <CommissionSettingForm current={currentCommission} />
      </Card>
    </div>
  );
}
