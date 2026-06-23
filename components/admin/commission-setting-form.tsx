"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { adminUpdateSetting } from "@/lib/supabase/rpc";

export function CommissionSettingForm({ current }: { current: number }) {
  const router = useRouter();
  const [value, setValue] = useState(String(current));
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const num = Number(value);
    if (isNaN(num) || num < 0 || num > 100) {
      setError("درصد باید بین ۰ تا ۱۰۰ باشه");
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: rpcError } = await adminUpdateSetting(supabase, {
      key: "marketplace_commission_percent",
      value: num,
    });
    setIsLoading(false);

    if (rpcError) {
      setError(rpcError.message);
      return;
    }

    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-start gap-3">
      <div className="flex-1">
        <Input
          type="number"
          dir="ltr"
          min={0}
          max={100}
          step={0.5}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="5"
        />
        {error && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}
        {success && (
          <div className="flex items-center gap-1.5 mt-1.5 text-xs text-neon-green-glow">
            <CheckCircle2 className="h-3.5 w-3.5" /> ذخیره شد
          </div>
        )}
      </div>
      <Button type="submit" size="sm" isLoading={isLoading}>
        ذخیره
      </Button>
    </form>
  );
}
