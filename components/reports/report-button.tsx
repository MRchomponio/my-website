"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Flag, AlertCircle, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { reportFormSchema } from "@/lib/validations/report";
import { translateDbError } from "@/lib/error-messages";
import type { ReportTargetType } from "@/types/database";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  /** The profile id of the person being reported (post author, reply
   * author, the user themselves, or the room host) — used so admins can
   * resolve the report without an extra lookup. Pass null only if there
   * truly is no associated user (shouldn't normally happen). */
  targetUserId: string | null;
  /** Compact icon-only button vs full button with label. */
  variant?: "icon" | "full";
}

const targetLabels: Record<ReportTargetType, string> = {
  post: "این پست",
  reply: "این پاسخ",
  user: "این کاربر",
  room: "این اتاق",
};

export function ReportButton({
  targetType,
  targetId,
  targetUserId,
  variant = "icon",
}: ReportButtonProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = reportFormSchema.safeParse({
      target_type: targetType,
      target_id: targetId,
      target_user_id: targetUserId,
      reason,
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
      router.push("/login");
      return;
    }

    const { error: insertError } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: parsed.data.target_type,
      target_id: parsed.data.target_id,
      target_user_id: parsed.data.target_user_id ?? null,
      reason: parsed.data.reason,
    });

    setIsLoading(false);

    if (insertError) {
      setError(translateDbError(insertError.message));
      return;
    }

    setSubmitted(true);
  }

  function handleClose() {
    setIsOpen(false);
    setReason("");
    setError(null);
    setSubmitted(false);
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={
          variant === "icon"
            ? "p-1.5 rounded-lg text-foreground-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors"
            : "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-foreground-subtle hover:text-red-400 hover:bg-red-500/10 transition-colors border border-background-border"
        }
        title="گزارش کردن"
      >
        <Flag className="h-4 w-4" />
        {variant === "full" && <span>گزارش</span>}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-background-surface border border-background-border p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">گزارش {targetLabels[targetType]}</h2>
              <button
                onClick={handleClose}
                className="p-1 rounded-lg text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {submitted ? (
              <div className="text-center py-4">
                <CheckCircle2 className="h-9 w-9 text-neon-green-glow mx-auto mb-3" />
                <p className="text-sm text-foreground-muted">
                  گزارشت ثبت شد. تیم ادمین بررسیش می‌کنه.
                </p>
                <Button variant="secondary" size="sm" className="mt-4" onClick={handleClose}>
                  باشه
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
                <p className="text-xs text-foreground-subtle">
                  چرا فکر می‌کنی {targetLabels[targetType]} باید بررسی بشه؟
                </p>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="توضیح بده..."
                  maxLength={500}
                  autoFocus
                />
                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <Button type="submit" size="sm" variant="danger" isLoading={isLoading}>
                    ثبت گزارش
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={handleClose}>
                    انصراف
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
