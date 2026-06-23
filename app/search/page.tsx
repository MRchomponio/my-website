import Link from "next/link";
import Image from "next/image";
import { Search } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Card, Avatar } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { globalSearch } from "@/lib/supabase/rpc";
import {
  groupSearchResults,
  searchResultHref,
  SEARCH_TYPE_LABELS,
  SEARCH_TYPE_ICONS,
} from "@/lib/search";

interface PageProps {
  searchParams: Promise<{ q?: string }>;
}

export default async function SearchPage({ searchParams }: PageProps) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const supabase = await createClient();

  const { data: results } =
    query.length >= 2
      ? await globalSearch(supabase, query, 20)
      : { data: [] };

  const grouped = groupSearchResults(results ?? []);
  const totalCount = results?.length ?? 0;

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">نتایج جستجو</h1>
        <p className="text-sm text-foreground-muted mb-6">
          {query
            ? `${totalCount} نتیجه برای «${query}»`
            : "عبارتی برای جستجو وارد کن."}
        </p>

        {query.length > 0 && query.length < 2 && (
          <Card className="p-8 text-center text-foreground-muted">
            حداقل ۲ کاراکتر وارد کن.
          </Card>
        )}

        {query.length >= 2 && totalCount === 0 && (
          <Card className="p-10 text-center text-foreground-muted">
            <Search className="h-8 w-8 mx-auto mb-3 text-foreground-subtle" />
            نتیجه‌ای برای «{query}» پیدا نشد.
          </Card>
        )}

        <div className="space-y-6">
          {(["post", "game", "room", "user"] as const).map((type) => {
            const items = grouped[type];
            if (items.length === 0) return null;
            const TypeIcon = SEARCH_TYPE_ICONS[type];

            return (
              <div key={type}>
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground-muted mb-3">
                  <TypeIcon className="h-4 w-4" />
                  {SEARCH_TYPE_LABELS[type]}
                  <span className="text-foreground-subtle">({items.length})</span>
                </h2>
                <div className="space-y-2">
                  {items.map((item) => (
                    <Link key={`${item.result_type}-${item.id}`} href={searchResultHref(item)}>
                      <Card className="p-3.5 flex items-center gap-3 hover:border-neon-blue/40 transition-colors">
                        {type === "user" ? (
                          <Avatar src={item.image_url} alt={item.title} size={34} />
                        ) : item.image_url ? (
                          <div className="w-9 h-9 rounded-xl overflow-hidden relative shrink-0 bg-background-elevated">
                            <Image
                              src={item.image_url}
                              alt={item.title}
                              fill
                              className="object-cover"
                              unoptimized
                            />
                          </div>
                        ) : (
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${item.accent_color ?? "#3b82f6"}20`,
                            }}
                          >
                            <TypeIcon
                              className="h-4 w-4"
                              style={{ color: item.accent_color ?? undefined }}
                            />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p className="text-xs text-foreground-subtle truncate">
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
