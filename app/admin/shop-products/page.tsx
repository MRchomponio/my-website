import Link from "next/link";
import Image from "next/image";
import { Plus, Pencil, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/lib/auth-helpers";
import { formatToman } from "@/lib/utils";
import { DeleteCurrencyProductButton } from "@/components/admin/delete-currency-product-button";
import { ToggleProductActiveButton } from "@/components/admin/toggle-product-active-button";

export default async function AdminShopProductsPage() {
  const { supabase } = await requireAdmin();

  const { data: products } = await supabase
    .from("currency_products")
    .select("*, games(name, accent_color)")
    .order("display_order", { ascending: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">محصولات فروشگاه ارز بازی</h1>
          <p className="text-sm text-foreground-muted mt-1">
            محصولات قابل خرید با کیف‌پول رو مدیریت کن.
          </p>
        </div>
        <Link href="/admin/shop-products/new">
          <Button size="sm">
            <Plus className="h-4 w-4" />
            افزودن محصول
          </Button>
        </Link>
      </div>

      {!products || products.length === 0 ? (
        <Card className="p-10 text-center text-foreground-muted">
          <Package className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
          هنوز هیچ محصولی اضافه نشده.
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((product) => {
            const game = product.games as unknown as { name: string; accent_color: string } | null;
            return (
              <Card key={product.id} className="p-4 flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl shrink-0 relative overflow-hidden border border-background-border bg-background-elevated">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-5 w-5 text-foreground-subtle" />
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold truncate">{product.name}</p>
                    {game && (
                      <span
                        className="text-xs px-1.5 py-0.5 rounded-md"
                        style={{ backgroundColor: `${game.accent_color}20`, color: game.accent_color }}
                      >
                        {game.name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-foreground-subtle mt-0.5">
                    {formatToman(product.price_rials)} تومان — {product.currency_amount.toLocaleString("en-US")}{" "}
                    {product.currency_unit_label || "واحد"}
                  </p>
                </div>

                <ToggleProductActiveButton productId={product.id} isActive={product.is_active} />

                <Link href={`/admin/shop-products/${product.id}/edit`}>
                  <Button variant="secondary" size="sm">
                    <Pencil className="h-3.5 w-3.5" />
                    ویرایش
                  </Button>
                </Link>

                <DeleteCurrencyProductButton productId={product.id} productName={product.name} />
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
