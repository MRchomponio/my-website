"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { awardManualBadge, revokeManualBadge } from "@/lib/supabase/rpc";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Badge = Database["public"]["Tables"]["badges"]["Row"];

export function ManageUserBadges({
  userId,
  badges,
  assignedBadgeIds,
}: {
  userId: string;
  badges: Badge[];
  assignedBadgeIds: string[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState(new Set(assignedBadgeIds));
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(badgeId: string) {
    setError(null);
    setLoadingId(badgeId);
    const supabase = createClient();

    const isAssigned = assigned.has(badgeId);
    const { error: rpcError } = isAssigned
      ? await revokeManualBadge(supabase, { userId, badgeId })
      : await awardManualBadge(supabase, { userId, badgeId });

    setLoadingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setAssigned((prev) => {
      const next = new Set(prev);
      if (isAssigned) {
        next.delete(badgeId);
      } else {
        next.add(badgeId);
      }
      return next;
    });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {badges.map((badge) => {
        const isAssigned = assigned.has(badge.id);
        return (
          <button
            key={badge.id}
            onClick={() => toggle(badge.id)}
            disabled={loadingId === badge.id}
            className={cn(
              "w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-right",
              isAssigned
                ? "bg-neon-purple/10 border-neon-purple/30"
                : "border-background-border hover:bg-background-elevated"
            )}
          >
            <BadgeIcon
              name={badge.name}
              description={badge.description}
              icon={badge.icon}
              size="sm"
            />
            <span className="flex-1 text-sm">{badge.name}</span>
            {loadingId === badge.id ? (
              <Loader2 className="h-4 w-4 animate-spin text-foreground-subtle" />
            ) : isAssigned ? (
              <X className="h-4 w-4 text-red-400" />
            ) : (
              <Plus className="h-4 w-4 text-foreground-subtle" />
            )}
          </button>
        );
      })}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
