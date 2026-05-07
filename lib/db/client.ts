import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseEnv } from "@/lib/env";
import * as schema from "./schema";

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

export function getDb() {
  if (_db) return _db;
  const env = databaseEnv();
  // `prepare: false` is required when using Supabase's transaction-mode pooler (port 6543).
  const client = postgres(env.url, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}
