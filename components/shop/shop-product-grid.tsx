"use client";

import { useState } from "react";
import Image from "next/image";
import { Package, ShoppingCart } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatToman } from "@/lib/utils";
import { PurchaseProductDialog } from "@/components/shop/purchase-product-dialog";

interface Product {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_rials: number;
  currency_amount: number;
  currency_unit_label: string | null;
  game_name?: string;
  game_accent_color?: string;
}

export function ShopProductGrid({
  products,
  walletBalanceRials,
}: {
  products: Product[];
  walletBalanceRials: number;
}) {
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  if (products.length === 0) {
    return (
      <Card className="p-10 text-center text-foreground-muted">
        <Package className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
        فعلاً محصولی برای این بخش موجود نیست.
      </Card>
    );
  }

  return (
    <>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((product) => (
          <Card key={product.id} className="overflow-hidden flex flex-col">
            <div className="relative w-full aspect-[4/3] bg-background-elevated">
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
                  <Package className="h-8 w-8 text-foreground-subtle" />
                </div>
              )}
              {product.game_name && (
                <span
                  className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full backdrop-blur-sm"
                  style={{
                    backgroundColor: `${product.game_accent_color ?? "#666"}30`,
                    color: product.game_accent_color ?? "#fff",
                  }}
                >
                  {product.game_name}
                </span>
              )}
            </div>
            <div className="p-4 flex-1 flex flex-col">
              <p className="font-semibold">{product.name}</p>
              <p className="text-xs text-foreground-subtle mt-0.5">
                {product.currency_amount.toLocaleString("en-US")}{" "}
                {product.currency_unit_label || "واحد"}
              </p>
              {product.description && (
                <p className="text-xs text-foreground-muted mt-2 line-clamp-2">
                  {product.description}
                </p>
              )}
              <div className="flex items-center justify-between mt-auto pt-4">
                <span className="font-bold">{formatToman(product.price_rials)} تومان</span>
                <Button size="sm" onClick={() => setSelectedProduct(product)}>
                  <ShoppingCart className="h-3.5 w-3.5" />
                  خرید
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {selectedProduct && (
        <PurchaseProductDialog
          product={selectedProduct}
          walletBalanceRials={walletBalanceRials}
          onClose={() => setSelectedProduct(null)}
        />
      )}
    </>
  );
}
