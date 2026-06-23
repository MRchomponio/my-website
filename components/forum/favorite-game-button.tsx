"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function FavoriteGameButton({
  gameId,
  isFavorited: initialIsFavorited,
  isLoggedIn,
}: {
  gameId: string;
  isFavorited: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [isFavorited, setIsFavorited] = useState(initialIsFavorited);
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    if (!isLoggedIn) {
      router.push("/login");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      router.push("/login");
      return;
    }

    if (isFavorited) {
      await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("game_id", gameId);
      setIsFavorited(false);
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, game_id: gameId });
      setIsFavorited(true);
    }

    setIsLoading(false);
    router.refresh();
  }

  return (
    <Button
      variant={isFavorited ? "secondary" : "outline"}
      size="sm"
      onClick={handleClick}
      isLoading={isLoading}
    >
      <Heart className={isFavorited ? "h-4 w-4 fill-current text-red-400" : "h-4 w-4"} />
      {isFavorited ? "دنبال می‌کنی" : "دنبال کردن"}
    </Button>
  );
}
