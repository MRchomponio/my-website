"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { POST_CATEGORIES } from "@/lib/post-categories";
import { cn } from "@/lib/utils";

export function PostFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeCategory = searchParams.get("category");
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");

  function updateParam(key: string, value: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    updateParam("q", searchValue.trim() || null);
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle" />
        <input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="جستجو در پست‌ها..."
          className="w-full h-10 rounded-xl bg-background-elevated border border-background-border pr-9 pl-3 text-sm outline-none focus:border-neon-blue/60"
        />
      </form>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => updateParam("category", null)}
          className={cn(
            "px-3 py-1.5 rounded-full text-sm border transition-colors",
            !activeCategory
              ? "bg-neon-blue/15 border-neon-blue/40 text-neon-blue-glow"
              : "border-background-border text-foreground-muted hover:text-foreground"
          )}
        >
          همه
        </button>
        {POST_CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => updateParam("category", cat.value)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors",
              activeCategory === cat.value
                ? "bg-neon-blue/15 border-neon-blue/40 text-neon-blue-glow"
                : "border-background-border text-foreground-muted hover:text-foreground"
            )}
          >
            <cat.icon className="h-3.5 w-3.5" />
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}
