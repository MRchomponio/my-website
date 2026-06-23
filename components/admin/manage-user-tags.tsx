"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { assignTag, unassignTag } from "@/lib/supabase/rpc";
import { TagPill } from "@/components/tags/tag-pill";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Tag = Database["public"]["Tables"]["tags"]["Row"];

export function ManageUserTags({
  userId,
  tags,
  assignedTagIds,
}: {
  userId: string;
  tags: Tag[];
  assignedTagIds: string[];
}) {
  const router = useRouter();
  const [assigned, setAssigned] = useState(new Set(assignedTagIds));
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function toggle(tagId: string) {
    setError(null);
    setLoadingId(tagId);
    const supabase = createClient();

    const isAssigned = assigned.has(tagId);
    const { error: rpcError } = isAssigned
      ? await unassignTag(supabase, { userId, tagId })
      : await assignTag(supabase, { userId, tagId });

    setLoadingId(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setAssigned((prev) => {
      const next = new Set(prev);
      if (isAssigned) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {tags.map((tag) => {
        const isAssigned = assigned.has(tag.id);
        return (
          <button
            key={tag.id}
            onClick={() => toggle(tag.id)}
            disabled={loadingId === tag.id}
            className={cn(
              "w-full flex items-center gap-3 p-2.5 rounded-xl border transition-colors text-right",
              isAssigned
                ? "border-background-border bg-background-elevated"
                : "border-background-border hover:bg-background-elevated"
            )}
          >
            <TagPill name={tag.name} color={tag.color} />
            <span className="flex-1" />
            {loadingId === tag.id ? (
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
