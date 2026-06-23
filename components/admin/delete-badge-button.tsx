"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeleteBadgeButton({
  badgeId,
  badgeName,
}: {
  badgeId: string;
  badgeName: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    // badges -> user_badges is ON DELETE CASCADE, so deleting a badge here
    // silently strips it from every user who currently holds it. Warn
    // explicitly since that's easy to miss compared to deleting a tag.
    if (
      !window.confirm(
        `حذف بج «${badgeName}» این بج رو از همه‌ی کاربرایی که الان دارنش هم حذف می‌کنه. ادامه می‌دی؟`
      )
    ) {
      setConfirming(false);
      return;
    }

    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("badges").delete().eq("id", badgeId);
    setIsDeleting(false);

    if (error) {
      alert(`حذف بج «${badgeName}» انجام نشد: ${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      onBlur={() => setConfirming(false)}
      disabled={isDeleting}
      className={
        confirming
          ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40 shrink-0"
          : "p-2 rounded-lg text-foreground-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors shrink-0"
      }
      title={confirming ? "برای تایید دوباره کلیک کن" : `حذف ${badgeName}`}
    >
      {isDeleting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : confirming ? (
        "مطمئنی؟"
      ) : (
        <Trash2 className="h-4 w-4" />
      )}
    </button>
  );
}
