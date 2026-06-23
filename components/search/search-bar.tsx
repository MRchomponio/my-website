"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Search, X, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { globalSearch, type GlobalSearchResult } from "@/lib/supabase/rpc";
import { groupSearchResults, searchResultHref, SEARCH_TYPE_LABELS, SEARCH_TYPE_ICONS } from "@/lib/search";
import { Avatar } from "@/components/ui/card";

interface SearchBarProps {
  autoFocus?: boolean;
  onNavigate?: () => void;
}

export function SearchBar({ autoFocus, onNavigate }: SearchBarProps = {}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GlobalSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoFocus) {
      inputRef.current?.focus();
      setIsOpen(true);
    }
  }, [autoFocus]);

  const runSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await globalSearch(supabase, q.trim(), 5);
    setResults(data ?? []);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(query), 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, runSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setIsOpen(false);
    onNavigate?.();
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  }

  const grouped = groupSearchResults(results);
  const hasAnyResults = results.length > 0;

  return (
    <div ref={containerRef} className="relative w-full max-w-xs">
      <form onSubmit={handleSubmit} className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-foreground-subtle pointer-events-none" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="جستجو در گیم‌هاب..."
          className="w-full h-9 rounded-xl bg-background-elevated border border-background-border pr-9 pl-8 text-sm outline-none focus:border-neon-blue/60"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setResults([]);
            }}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-foreground-subtle hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </form>

      {isOpen && query.trim().length >= 2 && (
        <div className="absolute top-full mt-2 w-full sm:w-[380px] right-0 rounded-2xl bg-background-surface border border-background-border shadow-2xl overflow-hidden max-h-[70vh] overflow-y-auto z-50">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-foreground-subtle" />
            </div>
          ) : !hasAnyResults ? (
            <p className="text-sm text-foreground-subtle text-center py-8">
              نتیجه‌ای برای «{query}» پیدا نشد.
            </p>
          ) : (
            <div className="py-2">
              {(["post", "game", "room", "user"] as const).map((type) => {
                const items = grouped[type];
                if (items.length === 0) return null;
                const TypeIcon = SEARCH_TYPE_ICONS[type];

                return (
                  <div key={type} className="px-2 py-1.5">
                    <p className="px-2 text-[11px] font-semibold text-foreground-subtle uppercase tracking-wide mb-1">
                      {SEARCH_TYPE_LABELS[type]}
                    </p>
                    {items.map((item) => (
                      <Link
                        key={`${item.result_type}-${item.id}`}
                        href={searchResultHref(item)}
                        onClick={() => {
                          setIsOpen(false);
                          onNavigate?.();
                        }}
                        className="flex items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-background-elevated transition-colors"
                      >
                        {type === "user" ? (
                          <Avatar src={item.image_url} alt={item.title} size={26} />
                        ) : item.image_url ? (
                          <div className="w-6 h-6 rounded-lg overflow-hidden relative shrink-0 bg-background-elevated">
                            <Image
                              src={item.image_url}
                              alt={item.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <TypeIcon
                            className="h-4 w-4 shrink-0"
                            style={{ color: item.accent_color ?? undefined }}
                          />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-foreground-subtle truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                );
              })}

              <Link
                href={`/search?q=${encodeURIComponent(query.trim())}`}
                onClick={() => {
                  setIsOpen(false);
                  onNavigate?.();
                }}
                className="block text-center text-xs text-neon-blue-glow py-2.5 border-t border-background-border mt-1 hover:bg-background-elevated transition-colors"
              >
                مشاهده همه نتایج
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
