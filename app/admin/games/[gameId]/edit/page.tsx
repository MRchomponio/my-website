import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { GameForm } from "@/components/admin/game-form";
import { createClient } from "@/lib/supabase/server";

// تعریف کامل نوع Game با تمام فیلدهای مورد نیاز
type Game = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  banner_url: string | null;
  icon_url: string | null;
  accent_color: string | null;
  created_at: string;
  // هر فیلد دیگه‌ای که ممکنه داشته باشی
};

interface PageProps {
  params: Promise<{ gameId: string }>;
}

export default async function EditGamePage({ params }: PageProps) {
  const { gameId } = await params;
  const supabase = await createClient();

  const { data: game } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .maybeSingle();

  if (!game) {
    notFound();
  }

  // تبدیل نوع game به Game
  const typedGame = game as Game;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">ویرایش {typedGame.name}</h1>
      <p className="text-sm text-foreground-muted mb-6">
        اطلاعات این بازی رو بروزرسانی کن.
      </p>
      <Card className="p-6 sm:p-7 max-w-xl">
        <GameForm game={typedGame} />
      </Card>
    </div>
  );
}
