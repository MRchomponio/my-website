"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { adminCloseRoom } from "@/lib/supabase/rpc";

export function CloseRoomButton({ roomId }: { roomId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleClick() {
    if (!confirming) {
      setConfirming(true);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error } = await adminCloseRoom(supabase, roomId);
    setIsLoading(false);

    if (error) {
      alert(`بستن اتاق انجام نشد: ${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      onBlur={() => setConfirming(false)}
      disabled={isLoading}
      className={
        confirming
          ? "px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40"
          : "p-1.5 rounded-lg text-foreground-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors"
      }
      title={confirming ? "برای تایید دوباره کلیک کن" : "بستن اتاق"}
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : confirming ? (
        "مطمئنی؟"
      ) : (
        <Lock className="h-4 w-4" />
      )}
    </button>
  );
}
