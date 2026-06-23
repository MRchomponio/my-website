"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { postFormSchema } from "@/lib/validations/post";
import { POST_CATEGORIES } from "@/lib/post-categories";
import { translateDbError } from "@/lib/error-messages";
import { cn } from "@/lib/utils";
import type { PostCategory } from "@/types/database";

export function PostForm({
  gameId,
  gameSlug,
}: {
  gameId: string;
  gameSlug: string;
}) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<PostCategory>("question");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = postFormSchema.safeParse({
      game_id: gameId,
      title,
      body,
      category,
    });

    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsLoading(false);
      setError("برای ساخت پست باید وارد حساب بشی.");
      return;
    }

    const { data: post, error: insertError } = await supabase
      .from("posts")
      .insert({ ...parsed.data, author_id: user.id })
      .select("id")
      .single();

    setIsLoading(false);

    if (insertError || !post) {
      setError(insertError ? translateDbError(insertError.message) : "مشکلی پیش اومد، دوباره امتحان کن.");
      return;
    }

    router.push(`/posts/${post.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium mb-2">دسته‌بندی</label>
        <div className="flex flex-wrap gap-2">
          {POST_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => setCategory(cat.value)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-colors",
                category === cat.value
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

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="title">
          عنوان
        </label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="عنوان پست رو واضح بنویس..."
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1.5" htmlFor="body">
          متن پست
        </label>
        <Textarea
          id="body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="توضیح بده..."
          className="min-h-[200px]"
          required
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" isLoading={isLoading}>
          انتشار پست
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => router.push(`/games/${gameSlug}`)}
        >
          انصراف
        </Button>
      </div>
    </form>
  );
}
