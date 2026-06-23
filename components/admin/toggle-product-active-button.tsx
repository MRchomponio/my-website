"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export function ToggleProductActiveButton({
  productId,
  isActive,
}: {
  productId: string;
  isActive: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleToggle() {
    setIsLoading(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("currency_products")
      .update({ is_active: !isActive })
      .eq("id", productId);
    setIsLoading(false);

    if (error) {
      alert(`تغییر وضعیت انجام نشد: ${error.message}`);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={cn(
        "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors shrink-0",
        isActive
          ? "bg-neon-green/10 text-neon-green-glow border-neon-green/30 hover:bg-neon-green/20"
          : "bg-background-elevated text-foreground-subtle border-background-border hover:border-foreground-subtle"
      )}
      title={isActive ? "غیرفعال کردن محصول" : "فعال کردن محصول"}
    >
      {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : isActive ? "فعال" : "غیرفعال"}
    </button>
  );
}
