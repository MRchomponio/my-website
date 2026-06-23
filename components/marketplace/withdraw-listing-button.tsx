"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function WithdrawListingButton({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  async function handleWithdraw() {
    if (!confirming) { setConfirming(true); return; }
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("account_listings")
      .delete()
      .eq("id", listingId);
    setIsLoading(false);
    if (error) { alert(error.message); return; }
    router.push("/marketplace/my-listings");
    router.refresh();
  }

  return (
    <button
      onClick={handleWithdraw}
      onBlur={() => setConfirming(false)}
      disabled={isLoading}
      className={
        confirming
          ? "px-3 py-1.5 rounded-xl text-xs font-medium bg-red-500/20 text-red-400 border border-red-500/40"
          : "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs text-foreground-subtle border border-background-border hover:text-red-400 hover:border-red-500/40 transition-colors"
      }
    >
      {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      {confirming ? "مطمئنی؟" : "پس گرفتن آگهی"}
    </button>
  );
}
