"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Gamepad2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { registerSchema } from "@/lib/validations/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const parsed = registerSchema.safeParse({
      username,
      email,
      password,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("username", parsed.data.username)
      .maybeSingle();

    if (existing) {
      setIsLoading(false);
      setError("این نام کاربری قبلاً گرفته شده.");
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { username: parsed.data.username },
      },
    });

    setIsLoading(false);

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data.session) {
      router.push("/feed");
      router.refresh();
      return;
    }

    setNeedsEmailConfirm(true);
  }

  if (needsEmailConfirm) {
    return (
      <main className="min-h-screen flex items-center justify-center px-4">
        <Card className="w-full max-w-sm p-7 text-center">
          <CheckCircle2 className="h-10 w-10 text-neon-green-glow mx-auto mb-4" />
          <h1 className="text-lg font-bold">ایمیلت رو چک کن</h1>
          <p className="text-sm text-foreground-muted mt-2">
            یه لینک تایید به <strong dir="ltr">{email}</strong> فرستادیم. روش
            کلیک کن تا حسابت فعال بشه، بعد وارد شو.
          </p>
          <Link href="/login" className="block mt-6">
            <Button variant="secondary" className="w-full">
              برو به صفحه ورود
            </Button>
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8">
          <Gamepad2 className="h-7 w-7 text-neon-blue-glow" />
          <span className="text-xl font-bold">گیم‌هاب</span>
        </Link>

        <Card className="p-7">
          <h1 className="text-xl font-bold text-center">ساخت حساب کاربری</h1>
          <p className="text-sm text-foreground-muted text-center mt-1.5 mb-6">
            به پلتفرم ساخته‌شده برای گیمرها بپیوند
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="username">
                نام کاربری
              </label>
              <Input
                id="username"
                dir="ltr"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="shadowblade42"
                required
              />
            </div>
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
                autoComplete="new-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" htmlFor="confirmPassword">
                تکرار رمز عبور
              </label>
              <Input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              ساخت حساب
            </Button>
          </form>

          <p className="text-sm text-foreground-muted text-center mt-6">
            قبلاً حساب ساختی؟{" "}
            <Link href="/login" className="text-neon-blue-glow hover:underline">
              وارد شو
            </Link>
          </p>
        </Card>
      </div>
    </main>
  );
}
