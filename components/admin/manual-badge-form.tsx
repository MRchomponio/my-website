"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { manualBadgeFormSchema } from "@/lib/validations/tag";
import { BADGE_ICONS } from "@/lib/badge-icons";
import { cn } from "@/lib/utils";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s_]/g, "")
    .replace(/\s+/g, "_");
}

export function ManualBadgeForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("Award");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = manualBadgeFormSchema.safeParse({ name, slug, description, icon });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("badges").insert({
      slug: parsed.data.slug,
      name: parsed.data.name,
      description: parsed.data.description,
      icon: parsed.data.icon,
      is_manual: true,
    });
    setIsLoading(false);

    if (insertError) {
      setError(
        insertError.message.includes("duplicate")
          ? "بجی با این شناسه از قبل وجود دارد."
          : insertError.message
      );
      return;
    }

    setName("");
    setSlug("");
    setSlugTouched(false);
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div>
        <label className="block text-sm font-medium mb-2">آیکون</label>
        <div className="grid grid-cols-6 gap-1.5">
          {Object.entries(BADGE_ICONS).map(([key, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setIcon(key)}
              className={cn(
                "flex items-center justify-center h-9 rounded-lg border transition-colors",
                icon === key
                  ? "bg-neon-purple/15 border-neon-purple/40 text-neon-purple-glow"
                  : "border-background-border text-foreground-muted hover:text-foreground"
              )}
              title={key}
            >
              <Icon className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="badgeName">
          نام بج
        </label>
        <Input
          id="badgeName"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="مثلاً قهرمان فصل"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="badgeSlug">
          شناسه (slug)
        </label>
        <Input
          id="badgeSlug"
          value={slug}
          dir="ltr"
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(slugify(e.target.value));
          }}
          placeholder="season_champion"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="badgeDescription">
          توضیحات
        </label>
        <Textarea
          id="badgeDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="چرا این بج اعطا میشه..."
          maxLength={150}
          className="min-h-[70px]"
          required
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="sm" isLoading={isLoading} className="w-full">
        افزودن بج
      </Button>
    </form>
  );
}
