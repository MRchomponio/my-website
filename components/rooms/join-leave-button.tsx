"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export function JoinLeaveButton({
  roomId,
  isMember,
  isFull,
  isHost,
}: {
  roomId: string;
  isMember: boolean;
  isFull: boolean;
  isHost: boolean;
}) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push(`/login?redirectTo=/rooms/${roomId}`);
      return;
    }

    if (isMember) {
      await supabase
        .from("room_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
    } else {
      await supabase
        .from("room_members")
        .insert({ room_id: roomId, user_id: user.id });
    }

    setIsLoading(false);
    router.refresh();
  }

  if (isHost) {
    return (
      <Button variant="secondary" size="sm" disabled>
        تو میزبان این اتاقی
      </Button>
    );
  }

  if (isMember) {
    return (
      <Button variant="outline" size="sm" onClick={handleClick} isLoading={isLoading}>
        <LogOut className="h-4 w-4" />
        ترک اتاق
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      onClick={handleClick}
      isLoading={isLoading}
      disabled={isFull}
    >
      <LogIn className="h-4 w-4" />
      {isFull ? "اتاق پر است" : "پیوستن به اتاق"}
    </Button>
  );
}
