"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pin } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function PinPostButton({
  postId,
  isPinned,
}: {
  postId: string;
  isPinned: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const supabase = createClient();

    await supabase.from("posts").update({ is_pinned: !isPinned }).eq("id", postId);

    setIsLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
        isPinned
          ? "bg-neon-purple/15 border-neon-purple/40 text-neon-purple-glow"
          : "border-background-border text-foreground-subtle hover:text-foreground hover:border-foreground-subtle"
      )}
      title={isPinned ? "برداشتن پین" : "پین کردن پست (ادمین)"}
    >
      <Pin className="h-3.5 w-3.5" />
      {isPinned ? "پین‌شده" : "پین کردن"}
    </button>
  );
}
