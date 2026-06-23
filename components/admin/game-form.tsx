"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { gameFormSchema } from "@/lib/validations/game";
import type { Database } from "@/types/database";

type Game = Database["public"]["Tables"]["games"]["Row"];

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#a855f7", // purple
  "#22d3ee", // cyan
  "#ff4655", // red
  "#5fba46", // green
  "#c8aa6e", // gold
];

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export function GameForm({ game }: { game?: Game }) {
  const router = useRouter();
  const isEditing = Boolean(game);

  const [name, setName] = useState(game?.name ?? "");
  const [slug, setSlug] = useState(game?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(isEditing);
  const [description, setDescription] = useState(game?.description ?? "");
  const [accentColor, setAccentColor] = useState(game?.accent_color ?? PRESET_COLORS[0]);
  const [bannerUrl, setBannerUrl] = useState<string | null>(game?.banner_url ?? null);
  const [iconUrl, setIconUrl] = useState<string | null>(game?.icon_url ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = gameFormSchema.safeParse({
      name,
      slug,
      description: description || null,
      accent_color: accentColor,
      banner_url: bannerUrl,
      icon_url: iconUrl,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    if (isEditing && game) {
      const { error: updateError } = await supabase
        .from("games")
        .update(parsed.data)
        .eq("id", game.id);
      setIsLoading(false);
      if (updateError) {
        setError(
          updateError.message.includes("duplicate")
            ? "این آدرس (slug) قبلاً استفاده شده."
            : updateError.message
        );
        return;
      }
    } else {
      const { error: insertError } = await supabase.from("games").insert(parsed.data);
      setIsLoading(false);
      if (insertError) {
        setError(
          insertError.message.includes("duplicate")
            ? "این آدرس (slug) قبلاً استفاده شده."
            : insertError.message
        );
        return;
      }
    }

    router.push("/admin/games");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <ImageUploader
          bucket="game-assets"
          value={iconUrl}
          onChange={setIconUrl}
          label="آیکون بازی"
          aspectRatio="square"
        />
        <ImageUploader
          bucket="game-assets"
          value={bannerUrl}
          onChange={setBannerUrl}
          label="بنر بازی"
          aspectRatio="banner"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="name">
          نام بازی
        </label>
        <Input
          id="name"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="مثلاً Valorant"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="slug">
          آدرس (slug)
        </label>
        <Input
          id="slug"
          dir="ltr"
          value={slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder="valorant"
          required
        />
        <p className="text-xs text-foreground-subtle mt-1" dir="ltr">
          /games/{slug || "..."}
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="description">
          توضیحات
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="توضیح کوتاه درباره بازی..."
          maxLength={300}
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">رنگ اختصاصی بازی</label>
        <div className="flex items-center gap-2.5 flex-wrap">
          {PRESET_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              onClick={() => setAccentColor(color)}
              className="w-8 h-8 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: color,
                borderColor: accentColor === color ? "#f4f4f6" : "transparent",
              }}
              aria-label={color}
            />
          ))}
          <input
            type="color"
            value={accentColor}
            onChange={(e) => setAccentColor(e.target.value)}
            className="w-8 h-8 rounded-full overflow-hidden border border-background-border bg-transparent cursor-pointer"
            title="انتخاب رنگ دلخواه"
          />
          <span className="text-xs text-foreground-subtle" dir="ltr">
            {accentColor}
          </span>
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
          {isEditing ? "ذخیره تغییرات" : "افزودن بازی"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push("/admin/games")}
        >
          انصراف
        </Button>
      </div>
    </form>
  );
}
