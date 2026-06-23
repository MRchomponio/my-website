"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Swords, Coffee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { ImageUploader } from "@/components/ui/image-uploader";
import { createClient } from "@/lib/supabase/client";
import { roomFormSchema } from "@/lib/validations/room";
import { cn } from "@/lib/utils";

interface Game {
  id: string;
  name: string;
  slug: string;
  accent_color: string;
  icon_url: string | null;
}

export function RoomForm({ games }: { games: Game[] }) {
  const router = useRouter();
  const [gameId, setGameId] = useState(games[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<"casual" | "competitive">("casual");
  const [maxPlayers, setMaxPlayers] = useState(5);
  const [bannerUrl, setBannerUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = roomFormSchema.safeParse({
      game_id: gameId,
      title,
      description: description || null,
      mode,
      max_players: maxPlayers,
      banner_url: bannerUrl,
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
      setError("برای ساخت اتاق باید وارد حساب بشی.");
      return;
    }

    const { data: room, error: insertError } = await supabase
      .from("rooms")
      .insert({ ...parsed.data, host_id: user.id })
      .select("id")
      .single();

    setIsLoading(false);

    if (insertError || !room) {
      setError(insertError?.message ?? "مشکلی پیش اومد، دوباره امتحان کن.");
      return;
    }

    router.push(`/rooms/${room.id}`);
    router.refresh();
  }

  if (games.length === 0) {
    return (
      <p className="text-sm text-foreground-muted">
        هنوز هیچ بازی‌ای در پلتفرم ثبت نشده، پس نمیشه اتاق ساخت. اول باید یه
        ادمین بازی اضافه کنه.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2">بازی</label>
        <div className="flex flex-wrap gap-2">
          {games.map((game) => (
            <button
              key={game.id}
              type="button"
              onClick={() => setGameId(game.id)}
              className={cn(
                "px-3 py-1.5 rounded-full text-sm border transition-colors",
                gameId === game.id
                  ? "text-white"
                  : "border-background-border text-foreground-muted hover:text-foreground"
              )}
              style={
                gameId === game.id
                  ? { backgroundColor: game.accent_color, borderColor: game.accent_color }
                  : undefined
              }
            >
              {game.name}
            </button>
          ))}
        </div>
      </div>

      <ImageUploader
        bucket="room-banners"
        value={bannerUrl}
        onChange={setBannerUrl}
        label="بنر اتاق (اختیاری)"
        aspectRatio="banner"
      />

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="title">
          عنوان اتاق
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="مثلاً: دنبال ۲ نفر برای رنک پلاتینیوم"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="description">
          توضیحات
        </label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="هر چیزی که هم‌تیمی‌ها باید بدونن..."
          maxLength={500}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-2">حالت بازی</label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("casual")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border text-sm transition-colors",
                mode === "casual"
                  ? "bg-neon-green/10 border-neon-green/40 text-neon-green-glow"
                  : "border-background-border text-foreground-muted"
              )}
            >
              <Coffee className="h-4 w-4" />
              رفاقتی
            </button>
            <button
              type="button"
              onClick={() => setMode("competitive")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 h-11 rounded-xl border text-sm transition-colors",
                mode === "competitive"
                  ? "bg-neon-purple/10 border-neon-purple/40 text-neon-purple-glow"
                  : "border-background-border text-foreground-muted"
              )}
            >
              <Swords className="h-4 w-4" />
              رقابتی
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" htmlFor="maxPlayers">
            تعداد نفرات (شامل خودت)
          </label>
          <Input
            id="maxPlayers"
            type="number"
            min={2}
            max={20}
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            required
          />
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" className="w-full" isLoading={isLoading}>
        ساخت اتاق
      </Button>
    </form>
  );
}
