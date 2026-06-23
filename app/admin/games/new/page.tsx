import { Card } from "@/components/ui/card";
import { GameForm } from "@/components/admin/game-form";

export default function NewGamePage() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">افزودن بازی جدید</h1>
      <p className="text-sm text-foreground-muted mb-6">
        یه بازی جدید به پلتفرم اضافه کن تا کاربرها بتونن دنبالش کنن و توش
        اتاق بسازن.
      </p>
      <Card className="p-6 sm:p-7 max-w-xl">
        <GameForm />
      </Card>
    </div>
  );
}
