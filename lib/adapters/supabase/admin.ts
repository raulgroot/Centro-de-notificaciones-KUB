import { createClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS — only use server-side for
 * admin tasks (cron jobs, internal API routes that shouldn't expose user context).
 *
 * NEVER import this in Client Components or expose its key to the browser.
 */
export function getSupabaseAdmin() {
  const env = supabaseAdminEnv();
  return createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
