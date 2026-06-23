"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function DeleteGameButton({
  gameId,
  gameName,
}: {
  gameId: string;
  gameName: string;
}) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setIsDeleting(true);
    const supabase = createClient();
    const { error } = await supabase.from("games").delete().eq("id", gameId);
    setIsDeleting(false);

    if (error) {
      alert(`حذف «${gameName}» انجام نشد: ${error.message}`);
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
          ? "px-3 py-2 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40"
          : "p-2 rounded-xl text-foreground-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors"
      }
      title={confirming ? "برای تایید دوباره کلیک کن" : `حذف ${gameName}`}
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
