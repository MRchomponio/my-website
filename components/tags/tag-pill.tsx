interface TagPillProps {
  name: string;
  color: string;
  description?: string;
  size?: "sm" | "md";
}

export function TagPill({ name, color, description, size = "md" }: TagPillProps) {
  return (
    <span
      title={description}
      className={
        size === "sm"
          ? "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium"
          : "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium"
      }
      style={{
        color,
        borderColor: `${color}50`,
        backgroundColor: `${color}1a`,
      }}
    >
      {name}
    </span>
  );
}
