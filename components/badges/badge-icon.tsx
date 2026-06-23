import { getBadgeIcon } from "@/lib/badge-icons";
import { cn } from "@/lib/utils";

interface BadgeIconProps {
  name: string;
  description: string;
  icon: string;
  size?: "sm" | "md" | "lg";
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-11 h-11",
  lg: "w-14 h-14",
};

const iconSizeClasses = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-6 w-6",
};

export function BadgeIcon({ name, description, icon, size = "md" }: BadgeIconProps) {
  const Icon = getBadgeIcon(icon);

  return (
    <div
      className="group relative inline-flex"
      title={`${name} — ${description}`}
    >
      <div
        className={cn(
          "flex items-center justify-center rounded-2xl bg-gradient-to-br from-neon-purple/20 to-neon-blue/20 border border-neon-purple/30 text-neon-purple-glow",
          sizeClasses[size]
        )}
      >
        <Icon className={iconSizeClasses[size]} />
      </div>
    </div>
  );
}
