"use client";

import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicEnv } from "@/lib/env";

/** Supabase client for use in Client Components. */
export function getSupabaseBrowser() {
  const env = supabasePublicEnv();
  return createBrowserClient(env.url, env.anonKey);
}
