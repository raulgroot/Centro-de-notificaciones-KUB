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
  /** Override to pin/bump model without code changes.
   *
   * Historia:
   *   - `claude-sonnet-4-5` (alias sin sufijo) fue deprecated entre fines
   *     de 2025 y 2026; Anthropic empezó a devolver 404.
   *   - El default ahora apunta a `claude-opus-4-7` — la mejor calidad
   *     disponible. Decisión consciente del costo (~5x Sonnet, ~$6/mes
   *     al volumen actual) porque las piezas HSBC se benefician de la
   *     creatividad extra de Opus.
   *   - Si en algún momento el costo se vuelve relevante, bajar a
   *     `claude-sonnet-4-6` (alias moderno) o `claude-sonnet-4-5-20250929`
   *     (versión datada, más estable).
   */
  model: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-7",
});

/** Freepik API for sourcing hero images in the /creation wizard. */
export const freepikEnv = () => ({
  apiKey: requireEnv("FREEPIK_API_KEY"),
});

/**
 * Unsplash API para buscar fotos lifestyle en el wizard de creación.
 * Reemplaza al provider Freepik (cuya cuenta gratis se agotó). El Access
 * Key se saca gratis en https://unsplash.com/developers — el free tier
 * de "demo app" cubre 50 requests/hora, suficiente para uso interno.
 */
export const unsplashEnv = () => ({
  accessKey: requireEnv("UNSPLASH_ACCESS_KEY"),
});

/**
 * Google AI Studio (Gemini / "Nano Banana") para generación text-to-image
 * directa en el wizard. Key gratis en https://aistudio.google.com/apikey.
 *
 * El default `gemini-3-pro-image-preview` es lo que coloquialmente se
 * conoce como "Nano Banana" — la última generación de modelos de imagen
 * de Google (preview), que está gratis durante el periodo de preview.
 * Es el modelo de mayor calidad y SÍ tiene free tier sin billing.
 *
 * Si ese modelo se gradúa de preview y empieza a requerir billing,
 * caer a `gemini-3.1-flash-image-preview` (más rápido, también free
 * en preview) vía `GEMINI_IMAGE_MODEL`.
 */
export const googleGenAiEnv = () => ({
  apiKey: requireEnv("GEMINI_API_KEY"),
  model: process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image-preview",
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
