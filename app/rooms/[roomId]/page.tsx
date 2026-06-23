import { notFound } from "next/navigation";
import Image from "next/image";
import { Users, Swords, Coffee, MessageSquare } from "lucide-react";
import { Navbar } from "@/components/layout/navbar";
import { Avatar, Card, PillBadge } from "@/components/ui/card";
import { TrustScoreBadge } from "@/components/profile/trust-score-badge";
import { JoinLeaveButton } from "@/components/rooms/join-leave-button";
import { RoomChat } from "@/components/rooms/room-chat";
import { ReportButton } from "@/components/reports/report-button";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ roomId: string }>;
}

export default async function RoomDetailPage({ params }: PageProps) {
  const { roomId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: room } = await supabase
    .from("rooms")
    .select(
      "*, games(name, slug, accent_color, icon_url), profiles!rooms_host_id_fkey(id, username, avatar_url, trust_score)"
    )
    .eq("id", roomId)
    .maybeSingle();

  if (!room) {
    notFound();
  }

  const game = room.games as unknown as {
    name: string;
    slug: string;
    accent_color: string;
    icon_url: string | null;
  } | null;

  const host = room.profiles as unknown as {
    id: string;
    username: string;
    avatar_url: string | null;
    trust_score: number;
  } | null;

  const { data: members } = await supabase
    .from("room_members")
    .select("user_id, joined_at, profiles(username, avatar_url, trust_score)")
    .eq("room_id", roomId)
    .order("joined_at");

  const isMember = Boolean(
    user && members?.some((m) => m.user_id === user.id)
  );
  const isHost = user?.id === host?.id;
  const memberCount = members?.length ?? 0;
  const isFull = memberCount >= room.max_players;

  let initialMessages: {
    id: string;
    body: string;
    created_at: string;
    author_id: string;
    profiles: { username: string; avatar_url: string | null } | null;
  }[] = [];

  if (isMember) {
    const { data: messages } = await supabase
      .from("room_messages")
      .select("id, body, created_at, author_id, profiles(username, avatar_url)")
      .eq("room_id", roomId)
      .order("created_at")
      .limit(100);

    initialMessages = (messages ?? []).map((m) => ({
      ...m,
      profiles: m.profiles as unknown as {
        username: string;
        avatar_url: string | null;
      } | null,
    }));
  }

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="overflow-hidden">
          <div
            className="h-32 relative bg-cover bg-center"
            style={{
              backgroundColor: `${game?.accent_color ?? "#3b82f6"}22`,
              backgroundImage: room.banner_url ? `url(${room.banner_url})` : undefined,
            }}
          >
            {game && (
              <span className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-black/60 backdrop-blur-sm px-3 py-1 text-xs font-medium text-white">
                {game.icon_url && (
                  <Image
                    src={game.icon_url}
                    alt={game.name}
                    width={16}
                    height={16}
                    className="rounded-full"
                    unoptimized
                  />
                )}
                {game.name}
              </span>
            )}
          </div>

          <div className="p-6">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-xl font-bold">{room.title}</h1>
                <div className="flex items-center gap-2 mt-2">
                  <PillBadge tone={room.mode === "competitive" ? "purple" : "green"}>
                    {room.mode === "competitive" ? (
                      <Swords className="h-3 w-3" />
                    ) : (
                      <Coffee className="h-3 w-3" />
                    )}
                    {room.mode === "competitive" ? "رقابتی" : "رفاقتی"}
                  </PillBadge>
                  <PillBadge tone="neutral">
                    <Users className="h-3 w-3" />
                    {memberCount}/{room.max_players} نفر
                  </PillBadge>
                  {room.status === "full" && (
                    <PillBadge tone="red">پر شده</PillBadge>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <JoinLeaveButton
                  roomId={room.id}
                  isMember={isMember}
                  isFull={isFull}
                  isHost={isHost}
                />
                {user && !isHost && host && (
                  <ReportButton
                    targetType="room"
                    targetId={room.id}
                    targetUserId={host.id}
                  />
                )}
              </div>
            </div>

            {room.description && (
              <p className="text-sm text-foreground-muted mt-4 whitespace-pre-wrap">
                {room.description}
              </p>
            )}

            {host && (
              <div className="flex items-center gap-2.5 mt-5 pt-5 border-t border-background-border">
                <Avatar src={host.avatar_url} alt={host.username} size={36} />
                <div>
                  <p className="text-xs text-foreground-subtle">میزبان اتاق</p>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{host.username}</span>
                    <TrustScoreBadge score={host.trust_score} size="sm" />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="mt-5">
          <h2 className="text-sm font-semibold text-foreground-muted mb-3">
            اعضای اتاق ({memberCount})
          </h2>
          <div className="flex flex-wrap gap-2">
            {members?.map((m) => {
              const memberProfile = m.profiles as unknown as {
                username: string;
                avatar_url: string | null;
                trust_score: number;
              } | null;
              if (!memberProfile) return null;
              return (
                <div
                  key={m.user_id}
                  className="flex items-center gap-2 bg-background-surface border border-background-border rounded-full pl-3 pr-1.5 py-1"
                >
                  <span className="text-xs">{memberProfile.username}</span>
                  <Avatar
                    src={memberProfile.avatar_url}
                    alt={memberProfile.username}
                    size={22}
                  />
                </div>
              );
            })}
          </div>
        </div>

        <Card className="mt-5">
          <div className="flex items-center gap-2 px-4 pt-4 pb-2">
            <MessageSquare className="h-4 w-4 text-foreground-muted" />
            <h2 className="text-sm font-semibold text-foreground-muted">
              گفتگوی اتاق
            </h2>
          </div>
          <RoomChat
            roomId={room.id}
            currentUserId={user?.id ?? null}
            initialMessages={initialMessages}
          />
        </Card>
      </main>
    </div>
  );
}
