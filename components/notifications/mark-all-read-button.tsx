"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function MarkAllReadButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const supabase = createClient();
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);
    setIsLoading(false);
    router.refresh();
  }

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} isLoading={isLoading}>
      <CheckCheck className="h-4 w-4" />
      علامت‌گذاری همه به‌عنوان خوانده‌شده
    </Button>
  );
}
