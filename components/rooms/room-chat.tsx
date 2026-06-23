"use client";

import { useState, useEffect, useRef } from "react";
import { Send } from "lucide-react";
import { Avatar } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { translateDbError } from "@/lib/error-messages";
import { formatDistanceToNow } from "date-fns";
import { faIR } from "date-fns/locale";

interface Message {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  profiles: { username: string; avatar_url: string | null } | null;
}

export function RoomChat({
  roomId,
  currentUserId,
  initialMessages,
}: {
  roomId: string;
  currentUserId: string | null;
  initialMessages: Message[];
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`room-${roomId}-messages`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "room_messages",
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          const { data: profile } = await supabase
            .from("profiles")
            .select("username, avatar_url")
            .eq("id", payload.new.author_id)
            .single();

          setMessages((prev) => [
            ...prev,
            {
              id: payload.new.id,
              body: payload.new.body,
              created_at: payload.new.created_at,
              author_id: payload.new.author_id,
              profiles: profile,
            },
          ]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim() || !currentUserId) return;
    setError(null);

    setIsSending(true);
    const supabase = createClient();
    const { error: insertError } = await supabase.from("room_messages").insert({
      room_id: roomId,
      author_id: currentUserId,
      body: body.trim(),
    });
    setIsSending(false);

    if (insertError) {
      setError(translateDbError(insertError.message));
      return;
    }

    setBody("");
  }

  return (
    <div className="flex flex-col h-[420px]">
      <div className="flex-1 overflow-y-auto space-y-3 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-foreground-subtle text-center mt-8">
            هنوز پیامی نیست. اولین نفری باش که سلام میده!
          </p>
        ) : (
          messages.map((msg) => (
            <div key={msg.id} className="flex items-start gap-2.5">
              <Avatar
                src={msg.profiles?.avatar_url}
                alt={msg.profiles?.username ?? "?"}
                size={30}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold">
                    {msg.profiles?.username}
                  </span>
                  <span className="text-[11px] text-foreground-subtle">
                    {formatDistanceToNow(new Date(msg.created_at), {
                      addSuffix: true,
                      locale: faIR,
                    })}
                  </span>
                </div>
                <p className="text-sm text-foreground-muted mt-0.5 break-words">
                  {msg.body}
                </p>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {currentUserId ? (
        <div className="border-t border-background-border">
          {error && (
            <p className="text-xs text-red-400 px-3 pt-2">{error}</p>
          )}
          <form
            onSubmit={handleSend}
            className="flex items-center gap-2 p-3"
          >
            <input
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="پیامت رو بنویس..."
              maxLength={1000}
              className="flex-1 h-10 rounded-xl bg-background-elevated border border-background-border px-3 text-sm outline-none focus:border-neon-blue/60"
            />
            <Button type="submit" size="sm" isLoading={isSending} disabled={!body.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      ) : (
        <p className="text-xs text-foreground-subtle text-center p-3 border-t border-background-border">
          برای ارسال پیام باید عضو اتاق باشی.
        </p>
      )}
    </div>
  );
}
