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

/**
 * Anthropic API for the /creation wizard. Direct integration (not via Vercel
 * AI Gateway) so billing flows straight to the user's Anthropic account and
 * the code is identical local and in prod.
 */
export const anthropicEnv = () => ({
  apiKey: requireEnv("ANTHROPIC_API_KEY"),
  /** Override to pin/bump model without code changes. */
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
});

/** Freepik API for sourcing hero images in the /creation wizard. */
export const freepikEnv = () => ({
  apiKey: requireEnv("FREEPIK_API_KEY"),
});

/**
 * Postmark server token for cross-referencing the HSBC catalog against the
 * real outbound logs. Accepts both POSTMARK_API_KEY (alias) and
 * POSTMARK_SERVER_TOKEN (Postmark's canonical name) so it's hard to misname
 * in Vercel envs.
 *
 * The token is a SERVER token scoped to HSBC's Postmark server — NOT the
 * account token. Server tokens are read-write for one server, which is what
 * we need for both message search and stats endpoints.
 */
export const postmarkEnv = () => {
  const token = process.env.POSTMARK_API_KEY ?? process.env.POSTMARK_SERVER_TOKEN ?? "";
  if (!token.trim()) {
    throw new Error(
      "Missing required env var: POSTMARK_API_KEY (or POSTMARK_SERVER_TOKEN). " +
        "Set it in .env.local (local) or Vercel project settings (production).",
    );
  }
  return { serverToken: token };
};
