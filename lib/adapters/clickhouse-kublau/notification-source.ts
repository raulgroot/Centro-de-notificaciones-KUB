import type {
  NotificationFilter,
  NotificationRecord,
  NotificationSource,
} from "@/lib/ports/notification-source";
import { getClickhouseClient } from "./client";

/**
 * NotificationSource adapter backed by Kublau's ClickHouse warehouse.
 *
 * The actual table/column names are unknown until we run `pnpm kublau:tables`
 * and `DESCRIBE TABLE` on the live warehouse. For now `listTables()` is the
 * only fully implemented method — it's enough to verify the connection works.
 *
 * Once the schema is mapped, fill in `list()`, `getById()`, `count()` and
 * remove the `notImplemented` helpers.
 */

const notImplemented = (method: string): never => {
  throw new Error(
    `kublauNotificationSource.${method} is not yet implemented. ` +
      `Run \`pnpm kublau:tables\` to discover the Kublau schema, then map it here.`,
  );
};

export const kublauNotificationSource: NotificationSource = {
  async list(_filter: NotificationFilter): Promise<NotificationRecord[]> {
    return notImplemented("list");
  },

  async getById(_id: string): Promise<NotificationRecord | null> {
    return notImplemented("getById");
  },

  async count(_filter: NotificationFilter): Promise<number> {
    return notImplemented("count");
  },

  async listTables(): Promise<string[]> {
    const client = getClickhouseClient();
    const result = await client.query({
      query: "SHOW TABLES",
      format: "JSON",
    });
    const data = (await result.json()) as { data: Array<{ name: string }> };
    return data.data.map((row) => row.name);
  },
};
