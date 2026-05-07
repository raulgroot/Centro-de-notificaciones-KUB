import { kublauNotificationSource } from "@/lib/adapters/clickhouse-kublau/notification-source";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tables = await kublauNotificationSource.listTables();
    return Response.json({ tables, count: tables.length });
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
