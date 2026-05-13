/**
 * Thin Asana REST client.
 *
 * Authenticates with a Personal Access Token (PAT) — see env var `ASANA_PAT`.
 * No SDK dependency to keep the bundle small; just `fetch` with the right
 * Authorization header.
 *
 * Docs: https://developers.asana.com/reference/rest-api-reference
 */

import { asanaEnv } from "@/lib/env";

const ASANA_API = "https://app.asana.com/api/1.0";

/** Subset of an Asana task we care about for campaign sync. */
export interface AsanaTask {
  gid: string;
  name: string;
  notes: string;
  /** When the task was created (ISO 8601). */
  created_at: string;
  /** Due date as "YYYY-MM-DD" string, or null. */
  due_on: string | null;
  completed: boolean;
  permalink_url: string;
  assignee?: { gid: string; name: string } | null;
  tags?: { gid: string; name: string }[];
}

interface PaginatedResponse<T> {
  data: T[];
  next_page?: { offset: string } | null;
}

async function asanaFetch<T>(path: string, params?: Record<string, string>): Promise<T> {
  const env = asanaEnv();
  const url = new URL(path.startsWith("http") ? path : ASANA_API + path);
  if (params) {
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  }
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.pat}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error("ASANA_TOKEN_INVALID: el PAT no tiene permisos o expiró");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Asana ${res.status}: ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/**
 * Returns every task tagged with the given tag GID, handling pagination so we
 * don't miss historical cargas. `opt_fields` keeps the response lean — Asana
 * returns just `gid` and `name` by default otherwise.
 */
export async function listTasksByTag(tagGid: string): Promise<AsanaTask[]> {
  const optFields = [
    "gid",
    "name",
    "notes",
    "created_at",
    "due_on",
    "completed",
    "permalink_url",
    "assignee.name",
    "tags.name",
  ].join(",");

  const tasks: AsanaTask[] = [];
  let offset: string | undefined;

  // Hard safety cap so a misconfigured tag never loops forever.
  for (let page = 0; page < 50; page++) {
    const params: Record<string, string> = {
      opt_fields: optFields,
      limit: "100",
    };
    if (offset) params.offset = offset;

    const res = await asanaFetch<PaginatedResponse<AsanaTask>>(`/tags/${tagGid}/tasks`, params);
    tasks.push(...res.data);
    if (!res.next_page) break;
    offset = res.next_page.offset;
  }

  return tasks;
}
