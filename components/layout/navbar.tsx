import Link from "next/link";
import { Gamepad2, Users, LayoutGrid, ShieldAlert, Wallet, ShoppingBag, Store, Package } from "lucide-react";
import { Avatar } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SearchTrigger } from "@/components/search/search-trigger";
import { formatToman } from "@/lib/utils";

export async function Navbar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: {
    username: string;
    avatar_url: string | null;
    is_admin: boolean;
  } | null = null;
  let unreadCount = 0;
  let walletBalance: number | null = null;

  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("username, avatar_url, is_admin")
      .eq("id", user.id)
      .single();
    profile = data;

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    unreadCount = count ?? 0;

    // Read-only display; the wallet row itself is created lazily by
    // get_or_create_wallet() the first time the user visits /wallet, so
    // it may not exist yet here — that's fine, we just show 0.
    const { data: wallet } = await supabase
      .from("wallets")
      .select("balance_rials")
      .eq("user_id", user.id)
      .maybeSingle();
    walletBalance = wallet?.balance_rials ?? 0;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-background-border bg-background/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link href="/feed" className="flex items-center gap-2">
          <Gamepad2 className="h-6 w-6 text-neon-blue-glow" />
          <span className="font-bold">گیم‌هاب</span>
        </Link>

        <nav className="hidden sm:flex items-center gap-1">
          <Link
            href="/feed"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <LayoutGrid className="h-4 w-4" />
            فید
          </Link>
          <Link
            href="/games"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <Gamepad2 className="h-4 w-4" />
            بازی‌ها
          </Link>
          <Link
            href="/rooms"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <Users className="h-4 w-4" />
            پیدا کردن هم‌تیمی
          </Link>
          <Link
            href="/shop"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <ShoppingBag className="h-4 w-4" />
            فروشگاه
          </Link>
          <Link
            href="/marketplace"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <Store className="h-4 w-4" />
            مارکت‌پلیس
          </Link>
          <Link
            href="/trade"
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
          >
            <Package className="h-4 w-4" />
            بازار آیتم
          </Link>
          {profile?.is_admin && (
            <Link
              href="/admin/games"
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-foreground-muted hover:text-foreground hover:bg-background-elevated transition-colors"
            >
              <ShieldAlert className="h-4 w-4" />
              ادمین
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <SearchTrigger />
          {user && (
            <Link
              href="/wallet"
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-background-elevated border border-background-border hover:border-neon-blue/40 transition-colors"
            >
              <Wallet className="h-3.5 w-3.5 text-neon-green-glow" />
              <span className="text-foreground">{formatToman(walletBalance ?? 0)}</span>
              <span className="text-foreground-subtle">تومان</span>
            </Link>
          )}
          {user && (
            <NotificationBell userId={user.id} initialUnreadCount={unreadCount} />
          )}
          {profile && (
            <Link href={`/profile/${profile.username}`}>
              <Avatar src={profile.avatar_url} alt={profile.username} size={34} />
            </Link>
          )}
          <SignOutButton />
        </div>
      </div>
    </header>
  );
}
