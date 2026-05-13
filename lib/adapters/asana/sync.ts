/**
 * Campaign-loads sync from Asana.
 *
 * For each campaign with an `asanaTagGid`, pull all tasks tagged with it and
 * upsert into `campaign_loads`. The unique key is `asana_gid` so a task
 * already imported is never duplicated.
 *
 * Date strategy:
 *   - Prefer `task.due_on` (Uriel sets it to the actual carga date).
 *   - If `due_on` is missing, the task is skipped and counted as "missing date".
 *     The UI surfaces these so Uriel can fill them in Asana.
 *
 * Status:
 *   - Asana `completed=true` → load.status = 'completed'
 *   - Otherwise → 'active' (only on insert; never overwrites manual edits)
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";
import { listTasksByTag, type AsanaTask } from "./client";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const env = supabaseAdminEnv();
  _client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export interface AsanaSyncResult {
  /** New campaign_loads rows inserted (date taken from `due_on`). */
  imported: number;
  /** Inserted rows where the date came from parsing YYMMDD out of the task name. */
  importedFromName: number;
  /** Existing rows where we refreshed metadata (notes/url). */
  updated: number;
  /** Tasks skipped because they had no usable date (neither due_on nor a YYMMDD in name). */
  missingDate: Array<{ taskGid: string; taskName: string; permalinkUrl: string; tagGid: string }>;
  /** Campaigns with `asanaTagGid` set but skipped this run (e.g. due to fetch error). */
  campaignsFailed: Array<{ campaignId: string; error: string }>;
  /** Total tasks scanned across all tags. */
  scanned: number;
}

interface CampaignWithTag {
  campaignId: string;
  asanaTagGid: string;
}

interface ExistingLoad {
  id: string;
  asanaGid: string;
}

async function fetchCampaignsWithTags(): Promise<
  Array<CampaignWithTag & { durationDays: number }>
> {
  const { data, error } = await client()
    .from("campaign_definitions")
    .select("id, asana_tag_gid, default_duration_days")
    .not("asana_tag_gid", "is", null);
  if (error) throw new Error(`Failed to load campaigns: ${error.message}`);
  return (data ?? [])
    .filter((r): r is { id: string; asana_tag_gid: string; default_duration_days: number } =>
      Boolean(r.asana_tag_gid),
    )
    .map((r) => ({
      campaignId: r.id,
      asanaTagGid: r.asana_tag_gid,
      durationDays: r.default_duration_days,
    }));
}

async function fetchExistingLoads(): Promise<Map<string, ExistingLoad>> {
  const { data, error } = await client()
    .from("campaign_loads")
    .select("id, asana_gid")
    .not("asana_gid", "is", null);
  if (error) throw new Error(`Failed to load existing loads: ${error.message}`);
  const map = new Map<string, ExistingLoad>();
  for (const row of data ?? []) {
    if (row.asana_gid) map.set(row.asana_gid, { id: row.id, asanaGid: row.asana_gid });
  }
  return map;
}

const parseDueOn = (raw: string | null): Date | null => {
  if (!raw) return null;
  const d = new Date(raw + "T00:00:00Z");
  return Number.isNaN(d.getTime()) ? null : d;
};

/**
 * Fallback date parser using Kublau's task-naming convention.
 *
 * Uriel names cargas tasks like `RET_PRO_260311` or `BB_260311` — the last
 * 6 digits are the carga date in YYMMDD. We only use this when `due_on` is
 * missing in Asana (lazy data entry shouldn't break the workflow).
 *
 * Returns null if no 6-digit suffix is found OR if the parsed values aren't
 * a real calendar date (e.g. "260230" — Feb 30 doesn't exist).
 */
const parseDateFromName = (name: string): Date | null => {
  const m = /(\d{6})\s*$/.exec(name.trim());
  if (!m || !m[1]) return null;
  const yy = Number(m[1].slice(0, 2));
  const mm = Number(m[1].slice(2, 4));
  const dd = Number(m[1].slice(4, 6));
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  // Assume current century (2000–2099). Wraps reasonably for any task created now.
  const d = new Date(Date.UTC(2000 + yy, mm - 1, dd));
  if (Number.isNaN(d.getTime())) return null;
  // Sanity-check the round-trip — Date silently coerces invalid days (Feb 30 → Mar 2).
  if (d.getUTCMonth() !== mm - 1 || d.getUTCDate() !== dd) return null;
  return d;
};

const buildNotes = (task: AsanaTask): string | null => {
  const trimmed = (task.notes || "").trim();
  if (!trimmed) return null;
  return trimmed.length > 500 ? trimmed.slice(0, 497) + "…" : trimmed;
};

export async function syncCampaignLoadsFromAsana(): Promise<AsanaSyncResult> {
  const result: AsanaSyncResult = {
    imported: 0,
    importedFromName: 0,
    updated: 0,
    missingDate: [],
    campaignsFailed: [],
    scanned: 0,
  };

  const campaigns = await fetchCampaignsWithTags();
  if (campaigns.length === 0) return result;

  const existing = await fetchExistingLoads();

  const now = Date.now();

  for (const { campaignId, asanaTagGid, durationDays } of campaigns) {
    let tasks: AsanaTask[];
    try {
      tasks = await listTasksByTag(asanaTagGid);
    } catch (e) {
      result.campaignsFailed.push({
        campaignId,
        error: e instanceof Error ? e.message : String(e),
      });
      continue;
    }

    result.scanned += tasks.length;

    for (const task of tasks) {
      // Date precedence: due_on (Asana field) → YYMMDD in task name → skip.
      let loadDate = parseDueOn(task.due_on);
      let dateFromName = false;
      if (!loadDate) {
        loadDate = parseDateFromName(task.name);
        dateFromName = loadDate !== null;
      }
      if (!loadDate) {
        result.missingDate.push({
          taskGid: task.gid,
          taskName: task.name,
          permalinkUrl: task.permalink_url,
          tagGid: asanaTagGid,
        });
        continue;
      }

      const found = existing.get(task.gid);
      const notes = buildNotes(task);

      const title = (task.name || "").trim() || null;

      if (found) {
        // Refresh title/notes/url; never overwrite loadDate or status (manual control).
        const { error } = await client()
          .from("campaign_loads")
          .update({
            title,
            asana_url: task.permalink_url,
            notes,
          })
          .eq("id", found.id);
        if (!error) result.updated++;
      } else {
        // Status comes from the CAMPAIGN'S elapsed window, NOT from Asana's
        // task.completed flag. Uriel marks the Asana task as completed once
        // he's done uploading the base — but the campaign itself runs for
        // 40/90 more days after that. So we ignore Asana's flag here.
        const elapsedDays = Math.floor((now - loadDate.getTime()) / 86_400_000);
        const status = elapsedDays > durationDays ? "completed" : "active";

        const { error } = await client().from("campaign_loads").insert({
          campaign_id: campaignId,
          load_date: loadDate.toISOString(),
          title,
          asana_url: task.permalink_url,
          asana_gid: task.gid,
          notes,
          status,
        });
        if (!error) {
          if (dateFromName) result.importedFromName++;
          else result.imported++;
        }
      }
    }
  }

  return result;
}
