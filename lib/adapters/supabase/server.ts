import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicEnv } from "@/lib/env";

/**
 * Returns a Supabase client for use in Server Components, Route Handlers,
 * and Server Actions. Reads/writes session cookies via Next.js `cookies()`.
 */
export async function getSupabaseServer() {
  const cookieStore = await cookies();
  const env = supabasePublicEnv();

  return createServerClient(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot set cookies. Safe to ignore — middleware will refresh.
        }
      },
    },
  });
}
