import { createClient, type ClickHouseClient } from "@clickhouse/client";
import { kublauEnv } from "@/lib/env";

let _client: ClickHouseClient | null = null;

/**
 * Returns a singleton ClickHouse client to Kublau's warehouse.
 * Called per-request in serverless; the singleton is per-instance,
 * so Fluid Compute reuses connections within an instance.
 */
export function getClickhouseClient(): ClickHouseClient {
  if (_client) return _client;
  const env = kublauEnv();
  _client = createClient({
    url: env.url,
    username: env.user,
    password: env.password,
    database: env.database,
    request_timeout: 30_000,
  });
  return _client;
}
