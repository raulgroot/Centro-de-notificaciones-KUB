export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "centro-de-notificaciones-kub",
    timestamp: new Date().toISOString(),
  });
}
