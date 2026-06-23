import { ShieldCheck, ShieldAlert, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustScoreBadgeProps {
  score: number;
  size?: "sm" | "md";
}

function getTrustTier(score: number) {
  if (score >= 75) {
    return {
      label: "قابل اعتماد",
      icon: ShieldCheck,
      classes: "bg-neon-green/10 text-neon-green-glow border-neon-green/30",
    };
  }
  if (score >= 40) {
    return {
      label: "متوسط",
      icon: Shield,
      classes: "bg-neon-blue/10 text-neon-blue-glow border-neon-blue/30",
    };
  }
  return {
    label: "نیاز به احتیاط",
    icon: ShieldAlert,
    classes: "bg-red-500/10 text-red-400 border-red-500/30",
  };
}

export function TrustScoreBadge({ score, size = "md" }: TrustScoreBadgeProps) {
  const tier = getTrustTier(score);
  const Icon = tier.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium",
        tier.classes,
        size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"
      )}
      title={`امتیاز اعتماد: ${score} از ۱۰۰`}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} />
      {score}
      <span className="opacity-70">·</span>
      <span>{tier.label}</span>
    </span>
  );
}
