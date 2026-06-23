"use client";

import { useState, useEffect } from "react";
import { Search, X } from "lucide-react";
import { SearchBar } from "@/components/search/search-bar";

export function SearchTrigger() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [isOpen]);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
        aria-label="جستجو"
      >
        <Search className="h-5 w-5" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center pt-20 px-4"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBar autoFocus onNavigate={() => setIsOpen(false)} />
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-lg text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors shrink-0"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
