"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { itemListingFormSchema } from "@/lib/validations/currency-shop";
import { formatToman } from "@/lib/utils";

interface Game { id: string; name: string; accent_color: string }

export function CreateItemListingForm({ games }: { games: Game[] }) {
  const router = useRouter();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrls, setImageUrls] = useState<(string | null)[]>([null]);
  const [priceToman, setPriceToman] = useState("");
  const [contactInfo, setContactInfo] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validImageUrls = imageUrls.filter((u): u is string => typeof u === "string");
    const parsed = itemListingFormSchema.safeParse({
      game_id: gameId,
      name,
      description,
      image_urls: validImageUrls,
      price_rials: Math.round(Number(priceToman) * 10),
      contact_info: contactInfo,
      quantity: Number(quantity),
    });

    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }

    setIsLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) { setIsLoading(false); setError("باید وارد حساب بشی."); return; }

    const { error: insertErr } = await supabase.from("item_listings").insert({
      seller_id: user.id,
      game_id: parsed.data.game_id,
      name: parsed.data.name,
      description: parsed.data.description,
      image_urls: parsed.data.image_urls,
      price_rials: parsed.data.price_rials,
      contact_info: parsed.data.contact_info,
      quantity: parsed.data.quantity,
    });

    setIsLoading(false);
    if (insertErr) { setError(insertErr.message); return; }

    setSuccess(true);
    router.refresh();
  }

  if (games.length === 0) {
    return (
      <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
        هنوز هیچ بازی‌ای اضافه نشده.
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="h-10 w-10 text-neon-green-glow mx-auto mb-3" />
        <p className="font-semibold">آگهی منتشر شد!</p>
        <p className="text-sm text-foreground-muted mt-1">آیتمت الان در بازار قابل مشاهده‌ست.</p>
        <div className="flex gap-3 justify-center mt-5">
          <Button onClick={() => router.push("/trade")}>بازار آیتم</Button>
          <Button variant="ghost" onClick={() => { setSuccess(false); setName(""); setDescription(""); setImageUrls([null]); setPriceToman(""); setContactInfo(""); setQuantity("1"); }}>
            آگهی جدید
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="game">بازی</label>
        <select id="game" value={gameId} onChange={(e) => setGameId(e.target.value)}
          className="w-full h-11 rounded-xl bg-background-elevated border border-background-border px-3.5 text-sm text-foreground outline-none focus:border-neon-blue/60 focus:ring-2 focus:ring-neon-blue/20" required>
          {games.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="name">نام آیتم</label>
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً: شمشیر افسانه‌ای +10" maxLength={100} required />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5">تصاویر (حداکثر ۶)</label>
        <div className="grid grid-cols-3 gap-2">
          {imageUrls.map((url, i) => (
            <div key={i} className="relative">
              <ImageUploader bucket="listing-images" value={url}
                onChange={(v) => { const u = [...imageUrls]; u[i] = v; setImageUrls(u); }}
                label="" aspectRatio="square" />
              {imageUrls.length > 1 && (
                <button type="button" onClick={() => setImageUrls(imageUrls.filter((_, idx) => idx !== i))}
                  className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center z-10">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
          ))}
          {imageUrls.length < 6 && (
            <button type="button" onClick={() => setImageUrls([...imageUrls, null])}
              className="aspect-square rounded-xl border border-dashed border-background-border flex items-center justify-center text-foreground-subtle hover:border-neon-blue/50 hover:text-foreground transition-colors">
              <Plus className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="description">توضیحات</label>
        <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="مشخصات آیتم، وضعیت، و نکات مهم..." maxLength={2000} className="min-h-[100px]" required />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="price">قیمت (تومان)</label>
          <Input id="price" type="number" dir="ltr" inputMode="numeric" min={1}
            value={priceToman} onChange={(e) => setPriceToman(e.target.value)} placeholder="50000" required />
          {priceToman && Number(priceToman) > 0 && (
            <p className="text-xs text-foreground-subtle mt-1">{formatToman(Math.round(Number(priceToman) * 10))} تومان</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="quantity">تعداد موجودی</label>
          <Input id="quantity" type="number" dir="ltr" inputMode="numeric" min={1} max={9999}
            value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="1" required />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="contactInfo">اطلاعات تماس در بازی</label>
        <Input id="contactInfo" value={contactInfo} onChange={(e) => setContactInfo(e.target.value)}
          placeholder="مثلاً آیدی بازیت که خریدار بتونه باهات trade کنه" maxLength={300} required />
        <p className="text-xs text-foreground-subtle mt-1">این اطلاعات برای همه قابل مشاهده‌ست.</p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
        </div>
      )}

      <Button type="submit" isLoading={isLoading} className="w-full">انتشار آگهی</Button>
    </form>
  );
}
