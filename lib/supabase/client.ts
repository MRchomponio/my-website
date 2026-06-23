import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

/**
 * Supabase client for use inside Client Components ("use client").
 * Uses the publishable key, which is safe to expose to the browser —
 * data access is enforced by Row Level Security (RLS) policies, not by
 * keeping this key secret.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
}
