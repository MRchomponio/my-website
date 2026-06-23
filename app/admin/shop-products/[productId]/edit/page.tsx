import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { CurrencyProductForm } from "@/components/admin/currency-product-form";
import { requireAdmin } from "@/lib/auth-helpers";

interface PageProps {
  params: Promise<{ productId: string }>;
}

export default async function EditCurrencyProductPage({ params }: PageProps) {
  const { productId } = await params;
  const { supabase } = await requireAdmin();

  const { data: product } = await supabase
    .from("currency_products")
    .select("*")
    .eq("id", productId)
    .maybeSingle();

  if (!product) {
    notFound();
  }

  const { data: games } = await supabase
    .from("games")
    .select("id, name")
    .order("name", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">ویرایش {product.name}</h1>
      <p className="text-sm text-foreground-muted mb-6">اطلاعات این محصول رو بروزرسانی کن.</p>
      <Card className="p-6 sm:p-7 max-w-xl">
        <CurrencyProductForm product={product} games={games ?? []} />
      </Card>
    </div>
  );
}
