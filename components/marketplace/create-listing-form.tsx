"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle, CheckCircle2, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { accountListingFormSchema } from "@/lib/validations/currency-shop";
import { formatToman } from "@/lib/utils";

interface Game {
  id: string;
  name: string;
  accent_color: string;
}

export function CreateListingForm({ games }: { games: Game[] }) {
  const router = useRouter();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([null]);
  const [priceToman, setPriceToman] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  function addImageSlot() {
    if (imageUrls.length < 6) setImageUrls([...imageUrls, null]);
  }

  function removeImageSlot(index: number) {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validImageUrls = imageUrls.filter((u): u is string => typeof u === "string");

    const parsed = accountListingFormSchema.safeParse({
      game_id: gameId,
      title,
      description,
      image_urls: validImageUrls,
      price_rials: Math.round(Number(priceToman) * 10),
      delivery_instructions: deliveryInstructions,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      setError("برای ثبت آگهی باید وارد حساب بشی.");
      return;
    }

    const { data: listing, error: insertErr } = await supabase
      .from("account_listings")
      .insert({
        seller_id: user.id,
        game_id: parsed.data.game_id,
        title: parsed.data.title,
        description: parsed.data.description,
        image_urls: parsed.data.image_urls,
        price_rials: parsed.data.price_rials,
      })
      .select("id")
      .single();

    if (insertErr || !listing) {
      setIsLoading(false);
      setError(insertErr?.message ?? "خطا در ثبت آگهی");
      return;
    }

    // Upsert delivery info in the separate table.
    const { error: deliveryErr } = await supabase
      .from("account_listing_delivery_info")
      .insert({ listing_id: listing.id, instructions: parsed.data.delivery_instructions });

    setIsLoading(false);

    if (deliveryErr) {
      // Listing was created but delivery info failed. Inform the user.
      setError(
        "آگهی ثبت شد اما اطلاعات تحویل ذخیره نشد. از طریق ویرایش آگهی اضافه‌شان کن: " +
          deliveryErr.message
      );
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  if (games.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        هنوز هیچ بازی‌ای در سایت اضافه نشده. قبل از ثبت آگهی، ادمین باید بازی اضافه کنه.
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <div className="w-12 h-12 rounded-full bg-neon-green/15 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-6 w-6 text-neon-green-glow" />
        </div>
        <p className="font-semibold">آگهی ثبت شد!</p>
        <p className="text-sm text-foreground-muted mt-1">
          آگهیت برای بررسی ادمین فرستاده شد. پس از تایید در مارکت‌پلیس نمایش داده میشه.
        </p>
        <div className="flex gap-3 justify-center mt-5">
          <Button onClick={() => router.push("/marketplace/my-listings")}>
            آگهی‌هایم
          </Button>
          <Button variant="ghost" onClick={() => { setSuccess(false); setTitle(""); setDescription(""); setImageUrls([null]); setPriceToman(""); setDeliveryInstructions(""); }}>
            ثبت آگهی جدید
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
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
        <label className="block text-sm font-medium mb-1.5" htmlFor="title">
          عنوان آگهی
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً: اکانت PUBG رنک Conqueror با 5000 UC"
          maxLength={150}
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">
          تصاویر آگهی (حداکثر ۶ تصویر)
        </label>
        <div className="grid grid-cols-3 gap-2">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative">
              <ImageUploader
                bucket="listing-images"
                value={url}
                onChange={(v) => {
                  const updated = [...imageUrls];
                  updated[i] = v;
                  setImageUrls(updated);
                }}
                label=""
                aspectRatio="square"
              />
              {imageUrls.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeImageSlot(i)}
                  className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center text-xs z-10"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {imageUrls.length < 6 && (
            <button
              type="button"
              onClick={addImageSlot}
              className="aspect-square rounded-xl border border-dashed border-background-border flex items-center justify-center text-foreground-subtle hover:text-foreground hover:border-neon-blue/50 transition-colors"
            >
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="description">
          توضیحات کامل
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="مشخصات اکانت، آیتم‌ها، رنک، تاریخچه، و هر چیز مهم دیگه‌ای رو بنویس..."
          maxLength={3000}
          className="min-h-[120px]"
          required
        />
      </div>

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
          placeholder="مثلاً 500000"
          required
        />
        {priceToman && Number(priceToman) > 0 && (
          <p className="text-xs text-foreground-subtle mt-1">
            {formatToman(Math.round(Number(priceToman) * 10))} تومان
          </p>
        )}
      </div>

      <div className="rounded-xl border border-background-border p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Lock className="h-4 w-4 text-neon-blue-glow" />
          اطلاعات تحویل (فقط برای خریدار نمایش داده میشه)
        </div>
        <p className="text-xs text-foreground-subtle">
          اطلاعات ورود به اکانت یا هر چیزی که خریدار برای دسترسی به اکانت نیاز داره اینجا بنویس.
          این اطلاعات تا زمان فروش مخفیه.
        </p>
        <Textarea
          value={deliveryInstructions}
          onChange={(e) => setDeliveryInstructions(e.target.value)}
          placeholder="ایمیل: example@gmail.com &#10;رمز: ..."
          maxLength={1000}
          className="min-h-[80px] font-mono text-sm"
          required
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">
        ثبت آگهی برای بررسی
      </Button>
    </form>
  );
}
