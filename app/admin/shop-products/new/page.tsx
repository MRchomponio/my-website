import { Card } from "@/components/ui/card";
import { CurrencyProductForm } from "@/components/admin/currency-product-form";
import { requireAdmin } from "@/lib/auth-helpers";

export default async function NewCurrencyProductPage() {
  const { supabase } = await requireAdmin();

  const { data: games } = await supabase
    .from("games")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">افزودن محصول جدید</h1>
      <p className="text-sm text-foreground-muted mb-6">
        یه محصول جدید به فروشگاه ارز بازی اضافه کن.
      </p>
      <Card className="p-6 sm:p-7 max-w-xl">
        <CurrencyProductForm games={games ?? []} />
      </Card>
    </div>
  );
}
