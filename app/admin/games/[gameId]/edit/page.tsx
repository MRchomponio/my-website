import { notFound } from "next/navigation";
import { Card } from "@/components/ui/card";
import { GameForm } from "@/components/admin/game-form";
import { createClient } from "@/lib/supabase/server";

// تعریف نوع برای Game
type Game = {
  id: string;
  name: string;
  description: string | null;
  // سایر فیلدهایی که ممکنه داشته باشی
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

  // تبدیل نوع game
  const typedGame = game as Game | null;

  if (!typedGame) {
    notFound();
  }

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
