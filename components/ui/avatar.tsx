import Image from "next/image";

interface AvatarProps {
  src?: string | null;
  alt?: string;
  size?: number;
  className?: string;
}

export function Avatar({ src, alt = "", size = 40, className = "" }: AvatarProps) {
  return (
    <div
      className={`rounded-full overflow-hidden bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {src ? (
        <Image src={src} alt={alt} width={size} height={size} className="object-cover" unoptimized />
      ) : (
        <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
          {alt?.[0]?.toUpperCase() || "?"}
        </span>
      )}
    </div>
  );
}
