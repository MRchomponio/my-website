"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, PillBadge } from "@/components/ui/card";
import { describeNotification } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";
import type { NotificationType } from "@/types/database";

interface NotificationItemProps {
  id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  isRead: boolean;
  createdAt: string;
}

export function NotificationItem({
  id,
  type,
  payload,
  isRead,
  createdAt,
}: NotificationItemProps) {
  const router = useRouter();
  const { icon: Icon, tone, text, href } = describeNotification(type, payload);

  async function handleClick() {
    if (isRead) return;
    const supabase = createClient();
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    router.refresh();
  }

  const content = (
    <Card
      className={cn(
        "p-4 flex items-start gap-3 transition-colors",
        !isRead && "border-neon-blue/30 bg-neon-blue/[0.03]"
      )}
    >
      <PillBadge tone={tone} className="!p-2 !rounded-xl shrink-0">
        <Icon className="h-4 w-4" />
      </PillBadge>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm", !isRead && "font-medium")}>{text}</p>
        <p className="text-xs text-foreground-subtle mt-1">
          {formatDistanceToNow(new Date(createdAt), {
            addSuffix: true,
            locale: faIR,
          })}
        </p>
      </div>
      {!isRead && (
        <span className="w-2 h-2 rounded-full bg-neon-blue-glow shrink-0 mt-1.5" />
      )}
    </Card>
  );

  if (href) {
    return (
      <Link href={href} onClick={handleClick}>
        {content}
      </Link>
    );
  }

  return (
    <button onClick={handleClick} className="w-full text-right">
      {content}
    </button>
  );
}
