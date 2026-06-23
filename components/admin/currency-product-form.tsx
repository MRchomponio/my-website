"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { currencyProductFormSchema } from "@/lib/validations/currency-shop";
import type { Database } from "@/types/database";

type CurrencyProduct = Database["public"]["Tables"]["currency_products"]["Row"];
type Game = { id: string; name: string };

export function CurrencyProductForm({
  product,
  games,
}: {
  product?: CurrencyProduct;
  games: Game[];
}) {
  const router = useRouter();
  const isEditing = Boolean(product);

  const [gameId, setGameId] = useState(product?.game_id ?? games[0]?.id ?? "");
  const [name, setName] = useState(product?.name ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(product?.image_url ?? null);
  // Entered in toman in the UI, converted to rials (×10) on submit —
  // matches the convention everywhere else in the app (formatToman).
  const [priceToman, setPriceToman] = useState(
    product ? String(Math.round(product.price_rials / 10)) : ""
  );
  const [currencyAmount, setCurrencyAmount] = useState(
    product ? String(product.currency_amount) : ""
  );
  const [currencyUnitLabel, setCurrencyUnitLabel] = useState(product?.currency_unit_label ?? "");
  const [isActive, setIsActive] = useState(product?.is_active ?? true);
  const [displayOrder, setDisplayOrder] = useState(String(product?.display_order ?? 0));
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = currencyProductFormSchema.safeParse({
      game_id: gameId,
      name,
      description: description || null,
      image_url: imageUrl,
      price_rials: Math.round(Number(priceToman) * 10),
      currency_amount: Number(currencyAmount),
      currency_unit_label: currencyUnitLabel || null,
      is_active: isActive,
      display_order: Number(displayOrder) || 0,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    if (isEditing && product) {
      const { error: updateError } = await supabase
        .from("currency_products")
        .update(parsed.data)
        .eq("id", product.id);
      setIsLoading(false);
      if (updateError) {
        setError(updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("currency_products").insert(parsed.data);
      setIsLoading(false);
      if (insertError) {
        setError(insertError.message);
        return;
      }
    }

    router.push("/admin/shop-products");
    router.refresh();
  }

  if (games.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        <span>
          قبل از افزودن محصول، حداقل یک بازی باید از{" "}
          <a href="/admin/games/new" className="underline">
            اینجا
          </a>{" "}
          اضافه کنی.
        </span>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <ImageUploader
        bucket="game-assets"
        value={imageUrl}
        onChange={setImageUrl}
        label="تصویر محصول"
        aspectRatio="square"
      />

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="game">
          بازی
        </label>
        <select
          id="game"
          value={gameId}
          onChange={(e) => setGameId(e.target.value)}
          className="w-full h-11 rounded-xl bg-background-elevated border border-background-border px-3.5 text-sm text-foreground outline-none focus:border-neon-blue/60 focus:ring-2 focus:ring-neon-blue/20"
          required
        >
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="name">
          نام محصول
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً 1000 سکه فری‌فایر"
          required
        />
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="price">
            قیمت (تومان)
          </label>
          <Input
            id="price"
            type="number"
            dir="ltr"
            inputMode="numeric"
            min={1}
            value={priceToman}
            onChange={(e) => setPriceToman(e.target.value)}
            placeholder="50000"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="amount">
            مقدار واحد پول
          </label>
          <Input
            id="amount"
            type="number"
            dir="ltr"
            inputMode="numeric"
            min={1}
            value={currencyAmount}
            onChange={(e) => setCurrencyAmount(e.target.value)}
            placeholder="1000"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="unitLabel">
            واحد (اختیاری)
          </label>
          <Input
            id="unitLabel"
            value={currencyUnitLabel}
            onChange={(e) => setCurrencyUnitLabel(e.target.value)}
            placeholder="سکه"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="description">
          توضیحات
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="توضیح کوتاه درباره این محصول..."
          maxLength={500}
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="displayOrder">
            ترتیب نمایش
          </label>
          <Input
            id="displayOrder"
            type="number"
            dir="ltr"
            value={displayOrder}
            onChange={(e) => setDisplayOrder(e.target.value)}
            placeholder="0"
          />
          <p className="text-xs text-foreground-subtle mt-1">عدد کوچیک‌تر، بالاتر نمایش داده میشه.</p>
        </div>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded accent-neon-blue"
            />
            محصول فعال باشد (در فروشگاه نمایش داده شود)
          </label>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={isLoading}>
          {isEditing ? "ذخیره تغییرات" : "افزودن محصول"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/admin/shop-products")}>
          انصراف
        </Button>
      </div>
    </form>
  );
}
