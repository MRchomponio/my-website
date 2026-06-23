"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function AcceptReplyButton({
  postId,
  replyId,
  isAccepted,
}: {
  postId: string;
  replyId: string;
  isAccepted: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const supabase = createClient();

    await supabase
      .from("posts")
      .update({ accepted_reply_id: isAccepted ? null : replyId })
      .eq("id", postId);

    setIsLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={isLoading}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors",
        isAccepted
          ? "bg-neon-green/15 border-neon-green/40 text-neon-green-glow"
          : "border-background-border text-foreground-subtle hover:text-foreground hover:border-foreground-subtle"
      )}
      title={isAccepted ? "حذف نشان بهترین پاسخ" : "علامت‌گذاری به‌عنوان بهترین پاسخ"}
    >
      <CheckCircle2 className="h-3.5 w-3.5" />
      {isAccepted ? "بهترین پاسخ" : "علامت‌گذاری به‌عنوان بهترین پاسخ"}
    </button>
  );
}
