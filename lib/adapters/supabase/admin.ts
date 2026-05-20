import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";

/**
 * Service-role Supabase client. Bypasses RLS — only use server-side for
 * admin tasks (cron jobs, internal API routes that shouldn't expose user context).
 *
 * NEVER import this in Client Components or expose its key to the browser.
 *
 * Singleton: la instancia se cachea por instance del runtime (Fluid Compute
 * reusa entre requests). Antes creábamos uno por cada llamada — cada page
 * del dashboard llama 3-5 veces, así que 3 navs rápidas = 15+ clients
 * nuevos abriendo conexiones HTTP al PostgREST. Eso era una fuente
 * confirmada de "se rompe al navegar rápido" / connection exhaustion.
 */
let _client: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_client) return _client;
  const env = supabaseAdminEnv();
  _client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Reusa connection pool del fetch interno entre requests.
    global: { fetch },
  });
  return _client;
}
