import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * Fetches the current logged-in user's profile, or redirects to /login
 * if not authenticated. Use at the top of any protected Server Component.
 */
export async function requireUser(): Promise<{
  profile: Profile;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return { profile, supabase };
}

/**
 * Same as requireUser(), but additionally redirects non-admins to /feed.
 * Use at the top of every admin-only Server Component/page.
 */
export async function requireAdmin(): Promise<{
  profile: Profile;
  supabase: Awaited<ReturnType<typeof createClient>>;
}> {
  const { profile, supabase } = await requireUser();

  if (!profile.is_admin) {
    redirect("/feed");
  }

  return { profile, supabase };
}
