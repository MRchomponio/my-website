"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function UpvoteButton({
  replyId,
  initialCount,
  initiallyVoted,
  isLoggedIn,
}: {
  replyId: string;
  initialCount: number;
  initiallyVoted: boolean;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [count, setCount] = useState(initialCount);
  const [voted, setVoted] = useState(initiallyVoted);
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

    if (voted) {
      await supabase
        .from("reply_votes")
        .delete()
        .eq("reply_id", replyId)
        .eq("user_id", user.id);
      setVoted(false);
      setCount((c) => c - 1);
    } else {
      await supabase.from("reply_votes").insert({ reply_id: replyId, user_id: user.id });
      setVoted(true);
      setCount((c) => c + 1);
    }

    setIsLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "flex flex-col items-center gap-0.5 px-2.5 py-1.5 rounded-xl border transition-colors min-w-[48px]",
        voted
          ? "bg-neon-blue/15 border-neon-blue/40 text-neon-blue-glow"
          : "border-background-border text-foreground-muted hover:text-foreground hover:border-foreground-subtle"
      )}
    >
      <ChevronUp className="h-4 w-4" />
      <span className="text-xs font-semibold">{count}</span>
    </button>
  );
}
