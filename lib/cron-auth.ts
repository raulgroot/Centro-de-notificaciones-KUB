/**
 * Gate compartido para los endpoints GET de cron (`/api/sync`,
 * `/api/refresh-metrics`, `/api/sync-campaigns`, `/api/qa/check-batches`).
 *
 * Falla CERRADO: si `CRON_SECRET` no está configurado en producción, el
 * endpoint responde 503 en lugar de quedar público — antes el check se
 * saltaba por completo y cualquiera podía disparar el sync (carga gratuita
 * contra el ClickHouse de Kublau y Supabase).
 *
 * Vercel inyecta `Authorization: Bearer ${CRON_SECRET}` automáticamente en
 * cada invocación de Vercel Cron cuando la env var existe en el proyecto.
 */
export function rejectUnauthorizedCron(request: Request): Response | null {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // En dev no exigimos el secreto, igual que el bypass de auth.config.ts.
    if (process.env.NODE_ENV !== "production") return null;
    return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
