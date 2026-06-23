interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline";
  className?: string;
}

export function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variants = {
    default: "bg-blue-500/10 text-blue-500",
    secondary: "bg-gray-500/10 text-gray-400",
    destructive: "bg-red-500/10 text-red-500",
    outline: "border border-gray-500/20 text-gray-400",
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded-full ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
