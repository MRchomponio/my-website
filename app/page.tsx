import Link from "next/link";
import { Gamepad2, MessageSquare, Users, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between px-6 py-5 max-w-6xl mx-auto">
        <div className="flex items-center gap-2">
          <Gamepad2 className="h-6 w-6 text-neon-blue-glow" />
          <span className="text-lg font-bold">گیم‌هاب</span>
        </div>
        <div className="flex items-center gap-3">
          {user ? (
            <Link href="/feed">
              <Button variant="secondary">ورود به فید</Button>
            </Link>
          ) : (
            <>
              <Link href="/login">
                <Button variant="ghost">ورود</Button>
              </Link>
              <Link href="/register">
                <Button>ثبت‌نام</Button>
              </Link>
            </>
          )}
        </div>
      </nav>

      <section className="max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight leading-[1.3]">
          جامعه‌ای ساخته‌شده برای{" "}
          <span className="text-gradient-neon">گیمرها</span>
        </h1>
        <p className="mt-6 text-lg text-foreground-muted max-w-2xl mx-auto">
          انجمن اختصاصی هر بازی، هم‌تیمی‌های آماده برای بازی، و سیستم اعتباری
          که واقعاً معنا داره.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href={user ? "/feed" : "/register"}>
            <Button size="lg">
              {user ? "ورود به فید" : "شروع کن — رایگانه"}
            </Button>
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 grid sm:grid-cols-3 gap-5">
        {[
          {
            icon: MessageSquare,
            title: "انجمن بازی‌ها",
            desc: "سوال بپرس، راهنما به اشتراک بذار، و از بازیکن‌های واقعی همون بازی کمک بگیر.",
          },
          {
            icon: Users,
            title: "پیدا کردن هم‌تیمی",
            desc: "اتاق بساز یا به اتاقی بپیوند — رفاقتی یا رقابتی، انتخاب با توئه.",
          },
          {
            icon: ShieldCheck,
            title: "امتیاز اعتماد",
            desc: "سیستم اعتباری که به بازیکن‌های مفید و قابل‌اعتماد پاداش می‌ده.",
          },
        ].map((f) => (
          <div
            key={f.title}
            className="rounded-2xl bg-background-surface border border-background-border p-6"
          >
            <f.icon className="h-8 w-8 text-neon-blue-glow mb-4" />
            <h3 className="font-semibold mb-2">{f.title}</h3>
            <p className="text-sm text-foreground-muted">{f.desc}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
