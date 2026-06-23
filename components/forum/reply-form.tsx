"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { replyFormSchema } from "@/lib/validations/post";
import { translateDbError } from "@/lib/error-messages";

export function ReplyForm({
  postId,
  isLoggedIn,
}: {
  postId: string;
  isLoggedIn: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = replyFormSchema.safeParse({ post_id: postId, body });
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
      router.push(`/login?redirectTo=/posts/${postId}`);
      return;
    }

    const { error: insertError } = await supabase.from("replies").insert({
      post_id: parsed.data.post_id,
      author_id: user.id,
      body: parsed.data.body,
    });

    setIsLoading(false);

    if (insertError) {
      setError(translateDbError(insertError.message));
      return;
    }

    setBody("");
    router.refresh();
  }

  if (!isLoggedIn) {
    return (
      <p className="text-sm text-foreground-muted text-center py-4">
        برای پاسخ دادن باید{" "}
        <a href={`/login?redirectTo=/posts/${postId}`} className="text-neon-blue-glow hover:underline">
          وارد حساب
        </a>{" "}
        بشی.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="پاسخت رو بنویس..."
        className="min-h-[100px]"
      />
      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      <Button type="submit" size="sm" isLoading={isLoading} disabled={!body.trim()}>
        ارسال پاسخ
      </Button>
    </form>
  );
}
