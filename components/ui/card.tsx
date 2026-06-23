import type { HTMLAttributes } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl bg-background-surface border border-background-border",
        className
      )}
      {...props}
    />
  );
}

interface AvatarProps {
  src?: string | null;
  alt: string;
  size?: number;
  online?: boolean;
}

export function Avatar({ src, alt, size = 40, online }: AvatarProps) {
  const initials = alt
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="rounded-full object-cover border border-background-border"
        />
      ) : (
        <div
          className="flex items-center justify-center rounded-full bg-gradient-to-br from-neon-blue/30 to-neon-purple/30 border border-background-border text-foreground font-semibold"
          style={{ width: size, height: size, fontSize: size * 0.38 }}
        >
          {initials}
        </div>
      )}
      {online !== undefined && (
        <span
          className={cn(
            "absolute bottom-0 right-0 block rounded-full border-2 border-background-surface",
            online ? "bg-neon-green-glow" : "bg-foreground-subtle"
          )}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}

type BadgeTone = "blue" | "purple" | "green" | "neutral" | "red";

interface PillBadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

const toneStyles: Record<BadgeTone, string> = {
  blue: "bg-neon-blue/10 text-neon-blue-glow border-neon-blue/30",
  purple: "bg-neon-purple/10 text-neon-purple-glow border-neon-purple/30",
  green: "bg-neon-green/10 text-neon-green-glow border-neon-green/30",
  neutral: "bg-background-elevated text-foreground-muted border-background-border",
  red: "bg-red-500/10 text-red-400 border-red-500/30",
};

export function PillBadge({ className, tone = "neutral", ...props }: PillBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
        toneStyles[tone],
        className
      )}
      {...props}
    />
  );
}
