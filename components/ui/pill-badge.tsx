interface PillBadgeProps {
  children: React.ReactNode;
  tone?: "green" | "neutral" | "red";
  className?: string;
}

export function PillBadge({ children, tone = "neutral", className = "" }: PillBadgeProps) {
  const tones = {
    green: "bg-green-500/10 text-green-500",
    neutral: "bg-gray-500/10 text-gray-400",
    red: "bg-red-500/10 text-red-500",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${tones[tone]} ${className}`}>
      {children}
    </span>
  );
}
