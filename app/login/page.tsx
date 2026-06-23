"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gamepad2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { loginSchema } from "@/lib/validations/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = loginSchema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setIsLoading(false);

    if (signInError) {
      setError(
        signInError.message === "Invalid login credentials"
          ? "ایمیل یا رمز عبور اشتباه است."
          : signInError.message
      );
      return;
    }

    router.push("/feed");
    router.refresh();
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Gamepad2 className="h-7 w-7 text-neon-blue-glow" />
          <span className="text-xl font-bold">گیم‌هاب</span>
        </Link>

        <Card className="p-7">
          <h1 className="text-xl font-bold text-center">خوش برگشتی</h1>
          <p className="text-sm text-foreground-muted text-center mt-1.5 mb-6">
            برای ادامه وارد حسابت شو
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="email">
                ایمیل
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="password">
                رمز عبور
              </label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 px-3 py-2.5 text-sm text-red-400">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button type="submit" className="w-full" isLoading={isLoading}>
              ورود
            </Button>
          </form>

          <p className="text-sm text-foreground-muted text-center mt-6">
            حساب نداری؟{" "}
            <Link href="/register" className="text-neon-blue-glow hover:underline">
              ثبت‌نام کن
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
