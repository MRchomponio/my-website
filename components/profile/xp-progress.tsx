import { Zap } from "lucide-react";
import { levelProgress } from "@/lib/xp";

export function XpProgress({ xp, level }: { xp: number; level: number }) {
  const { remainingXp, percent } = levelProgress(xp, level);

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-foreground-muted mb-1.5">
        <span className="flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-neon-blue-glow" />
          سطح {level}
        </span>
        <span>{remainingXp} XP تا سطح بعد</span>
      </div>
      <div className="h-2 rounded-full bg-background-elevated overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-blue to-neon-purple transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}
