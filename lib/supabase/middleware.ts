import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PROTECTED_SEGMENTS = ["feed", "rooms", "settings", "notifications"];

/**
 * Refreshes the Supabase session for the incoming request and redirects
 * unauthenticated users away from protected routes. Locale-aware: the
 * first path segment is treated as the locale (e.g. /en/feed, /fa/feed).
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not run any logic between createServerClient and
  // getUser(). A simple mistake here can cause hard-to-debug session
  // refresh issues.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const segments = request.nextUrl.pathname.split("/").filter(Boolean);
  const [locale, firstSegment] = segments;
  const isProtected = PROTECTED_SEGMENTS.includes(firstSegment ?? "");

  if (!user && isProtected) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}/login`;
    redirectUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return supabaseResponse;
}
