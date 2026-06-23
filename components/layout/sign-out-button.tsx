"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <button
      onClick={handleSignOut}
      className="p-2 rounded-lg text-foreground-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
      title="Log out"
      aria-label="Log out"
    >
      <LogOut className="h-5 w-5" />
    </button>
  );
}
