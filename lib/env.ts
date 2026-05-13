/**
 * Environment variable accessors.
 *
 * Each domain has its own getter so we only require what's actually used at runtime.
 * Calling `kublauEnv()` from a route that doesn't use Kublau will not crash the
 * Supabase route. This keeps the app bootable in dev with partial config.
 */

const requireEnv = (key: string): string => {
  const v = process.env[key];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required env var: ${key}. ` +
        `Set it in .env.local (local) or Vercel project settings (production).`,
    );
  }
  return v;
};

export const kublauEnv = () => ({
  url: requireEnv("CLICKHOUSE_URL"),
  user: requireEnv("CLICKHOUSE_USER"),
  password: requireEnv("CLICKHOUSE_PASSWORD"),
  database: process.env.CLICKHOUSE_DATABASE ?? "kublau_report",
});

export const supabasePublicEnv = () => ({
  url: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
});

export const supabaseAdminEnv = () => ({
  ...supabasePublicEnv(),
  serviceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
});

export const databaseEnv = () => ({
  url: requireEnv("DATABASE_URL"),
});

export const aiEnv = () => ({
  gatewayApiKey: process.env.AI_GATEWAY_API_KEY,
});

export const asanaEnv = () => ({
  pat: requireEnv("ASANA_PAT"),
  /** Kublau's Asana workspace. Falls back to the value from the legacy platform. */
  workspaceGid: process.env.ASANA_WORKSPACE_GID ?? "1117756250049910",
});
