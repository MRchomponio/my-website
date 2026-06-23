import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Must be created fresh on every request because it reads cookies().
 * Still uses the publishable key — RLS enforces access control.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll was called from a Server Component that can't set
            // cookies directly. Safe to ignore because middleware.ts
            // refreshes the session on every request.
          }
        },
      },
    }
  );
}

/**
 * Admin client that BYPASSES Row Level Security using the secret key.
 * Only ever import this inside server-only code (route handlers, server
 * actions) for trusted operations like moderation actions that must read
 * or write across all users' data. NEVER import this in a Client Component
 * and never send the secret key to the browser.
 */
export async function createAdminClient() {
  const { createClient: createSupabaseClient } = await import("@supabase/supabase-js");
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  );
}
