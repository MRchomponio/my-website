import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { BadgeIcon } from "@/components/badges/badge-icon";
import { createClient } from "@/lib/supabase/server";

export default async function BadgesPage() {
  const supabase = await createClient();
  const { data: badges } = await supabase
    .from("badges")
    .select("*")
    .order("name");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">بج‌ها</h1>
        <p className="text-sm text-foreground-muted mb-6">
          با مشارکت تو انجمن، این بج‌ها رو برای پروفایلت باز کن.
        </p>

        <div className="space-y-3">
          {badges?.map((badge) => (
            <Card key={badge.id} className="p-4 flex items-center gap-4">
              <BadgeIcon
                name={badge.name}
                description={badge.description}
                icon={badge.icon}
                size="lg"
              />
              <div>
                <h3 className="font-semibold">{badge.name}</h3>
                <p className="text-sm text-foreground-muted mt-0.5">
                  {badge.description}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
