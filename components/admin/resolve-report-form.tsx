"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { resolveReport } from "@/lib/supabase/rpc";

export function ResolveReportForm({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [penalty, setPenalty] = useState(10);
  const [loadingAction, setLoadingAction] = useState<"valid" | "invalid" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleResolve(isValid: boolean) {
    setError(null);
    setLoadingAction(isValid ? "valid" : "invalid");

    const supabase = createClient();
    const { error: rpcError } = await resolveReport(supabase, {
      reportId,
      isValid,
      penalty: isValid ? penalty : 0,
    });

    setLoadingAction(null);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    router.refresh();
  }

  return (
    <div className="space-y-3 pt-3 border-t border-background-border">
      <div className="flex items-center gap-2">
        <label htmlFor={`penalty-${reportId}`} className="text-xs text-foreground-muted shrink-0">
          کسر امتیاز اعتماد در صورت تایید:
        </label>
        <Input
          id={`penalty-${reportId}`}
          type="number"
          min={0}
          max={100}
          value={penalty}
          onChange={(e) => setPenalty(Number(e.target.value))}
          className="w-20 h-8 text-sm"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => handleResolve(true)}
          isLoading={loadingAction === "valid"}
          disabled={loadingAction !== null}
          className="!bg-neon-green/15 !border !border-neon-green/40 !text-neon-green-glow"
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          معتبر — {penalty} امتیاز کسر بشه
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => handleResolve(false)}
          isLoading={loadingAction === "invalid"}
          disabled={loadingAction !== null}
        >
          <XCircle className="h-3.5 w-3.5" />
          نامعتبر
        </Button>
      </div>
    </div>
  );
}
