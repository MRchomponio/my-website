"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { adminRemoveItemListing } from "@/lib/supabase/rpc";

export function RemoveItemListingForm({ listingId }: { listingId: string }) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [showInput, setShowInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRemove() {
    if (!showInput) { setShowInput(true); return; }
    if (!reason.trim()) { setError("دلیل رو وارد کن"); return; }
    setError(null);
    setIsLoading(true);
    const supabase = createClient();
    const { error: e } = await adminRemoveItemListing(supabase, { listingId, reason: reason.trim() });
    setIsLoading(false);
    if (e) { setError((e as { message: string }).message); return; }
    router.refresh();
  }

  return (
    <div className="space-y-2 pt-3 border-t border-background-border">
      {showInput && (
        <Input value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="دلیل حذف..." className="h-9 text-sm" autoFocus />
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5" />{error}
        </div>
      )}
      <Button size="sm" variant="ghost" onClick={handleRemove} isLoading={isLoading}>
        <Trash2 className="h-3.5 w-3.5" />
        {showInput ? "تایید حذف" : "حذف آگهی"}
      </Button>
    </div>
  );
}
