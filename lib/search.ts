import { FileText, User, Gamepad2, Users, type LucideIcon } from "lucide-react";
import type { GlobalSearchResult, GlobalSearchResultType } from "@/lib/supabase/rpc";

export const SEARCH_TYPE_LABELS: Record<GlobalSearchResultType, string> = {
  post: "پست",
  user: "کاربر",
  game: "بازی",
  room: "اتاق",
};

export const SEARCH_TYPE_ICONS: Record<GlobalSearchResultType, LucideIcon> = {
  post: FileText,
  user: User,
  game: Gamepad2,
  room: Users,
};

export function searchResultHref(result: GlobalSearchResult): string {
  switch (result.result_type) {
    case "post":
      return `/posts/${result.id}`;
    case "user":
      return `/profile/${result.slug ?? ""}`;
    case "game":
      return `/games/${result.slug ?? result.id}`;
    case "room":
      return `/rooms/${result.id}`;
    default:
      return "/";
  }
}

/** Groups a flat result list into the 4 buckets, preserving rank order
 * within each bucket as returned by the database. */
export function groupSearchResults(results: GlobalSearchResult[]) {
  const groups: Record<GlobalSearchResultType, GlobalSearchResult[]> = {
    post: [],
    user: [],
    game: [],
    room: [],
  };
  for (const r of results) {
    groups[r.result_type].push(r);
  }
  return groups;
}
