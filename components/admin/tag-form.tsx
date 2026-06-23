"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { tagFormSchema } from "@/lib/validations/tag";

const PRESET_COLORS = [
  "#3b82f6",
  "#a855f7",
  "#22d3ee",
  "#facc15",
  "#f97316",
  "#ef4444",
  "#22c55e",
];

export function TagForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = tagFormSchema.safeParse({ name, description, color });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("tags").insert({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      color: parsed.data.color,
    });
    setIsLoading(false);

    if (insertError) {
      setError(
        insertError.message.includes("duplicate")
          ? "تگی با این نام از قبل وجود دارد."
          : insertError.message
      );
      return;
    }

    setName("");
    setDescription("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="tagName">
          نام تگ
        </label>
        <Input
          id="tagName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="مثلاً Pro Player"
          dir="ltr"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="tagDescription">
          توضیحات
        </label>
        <Textarea
          id="tagDescription"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="این تگ چه معنایی دارد..."
          maxLength={150}
          className="min-h-[70px]"
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">رنگ</label>
        <div className="flex items-center gap-2 flex-wrap">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="w-7 h-7 rounded-full border-2 transition-transform hover:scale-110"
              style={{
                backgroundColor: c,
                borderColor: color === c ? "#f4f4f6" : "transparent",
              }}
              aria-label={c}
            />
          ))}
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-7 h-7 rounded-full overflow-hidden border border-background-border bg-transparent cursor-pointer"
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" size="sm" isLoading={isLoading} className="w-full">
        افزودن تگ
      </Button>
    </form>
  );
}
