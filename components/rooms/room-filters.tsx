"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

interface Game {
  id: string;
  name: string;
  slug: string;
  accent_color: string;
}

export function RoomFilters({ games }: { games: Game[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeGame = searchParams.get("game");
  const activeMode = searchParams.get("mode");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`/rooms?${params.toString()}`);
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => updateParam("game", null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            !activeGame
              ? "bg-neon-blue/15 border-neon-blue/40 text-neon-blue-glow"
              : "border-background-border text-foreground-muted hover:text-foreground"
          )}
        >
          همه بازی‌ها
        </button>
        {games.map((game) => (
          <button
            key={game.id}
            onClick={() => updateParam("game", game.slug)}
            className={cn(
              "px-3 py-1.5 rounded-full text-sm border transition-colors",
              activeGame === game.slug
                ? "text-white"
                : "border-background-border text-foreground-muted hover:text-foreground"
            )}
            style={
              activeGame === game.slug
                ? { backgroundColor: game.accent_color, borderColor: game.accent_color }
                : undefined
            }
          >
            {game.name}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        {[
          { value: null, label: "همه حالت‌ها" },
          { value: "casual", label: "رفاقتی" },
          { value: "competitive", label: "رقابتی" },
        ].map((opt) => (
          <button
            key={opt.label}
            onClick={() => updateParam("mode", opt.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs border transition-colors",
              activeMode === opt.value
                ? "bg-background-elevated border-foreground-subtle text-foreground"
                : "border-background-border text-foreground-subtle hover:text-foreground"
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
