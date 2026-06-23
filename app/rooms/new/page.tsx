import { redirect } from "next/navigation";
import { Navbar } from "@/components/layout/navbar";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { RoomForm } from "@/components/rooms/room-form";

export default async function NewRoomPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/rooms/new");
  }

  const { data: games } = await supabase
    .from("games")
    .select("id, name, slug, accent_color, icon_url")
    .order("name");

  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="max-w-xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-1">ساخت اتاق جدید</h1>
        <p className="text-sm text-foreground-muted mb-6">
          هم‌تیمی پیدا کن. خودت به‌طور خودکار اولین عضو اتاق میشی.
        </p>
        <Card className="p-6 sm:p-7">
          <RoomForm games={games ?? []} />
        </Card>
      </main>
    </div>
  );
}
