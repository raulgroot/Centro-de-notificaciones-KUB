/**
 * Supabase adapter for campaign data: definitions, milestones, and active
 * loads. All reads/writes go via PostgREST (HTTPS) so we don't depend on
 * Direct Postgres reachability from Vercel.
 *
 * This is the only file outside of `app/` that should touch these tables.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const env = supabaseAdminEnv();
  _client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// ─────────────────────────────────────────────────────────────────────────────
// Types

export type MilestoneTriggerType = "time" | "event" | "manual";

export interface CampaignDefinition {
  id: string;
  name: string;
  accentColor: string;
  defaultDurationDays: number;
  active: boolean;
  sortOrder: number;
}

export interface CampaignMilestone {
  id: string;
  campaignId: string;
  position: number;
  label: string;
  description: string;
  /** null when triggerType !== 'time'. */
  dayOffset: number | null;
  triggerType: MilestoneTriggerType;
  flag: number | null;
}

export interface CampaignLoad {
  id: string;
  campaignId: string;
  loadDate: Date;
  deadline: Date | null;
  /** Human-readable title (typically the Asana task name). May include variant
   *  info like "_sin_one" so cargas on the same date can be told apart. */
  title: string | null;
  asanaUrl: string | null;
  notes: string | null;
  status: "active" | "completed" | "paused";
  createdAt: Date;
  endedAt: Date | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reads

interface RawDefinition {
  id: string;
  name: string;
  accent_color: string;
  default_duration_days: number;
  active: boolean;
  sort_order: number;
}

interface RawMilestone {
  id: string;
  campaign_id: string;
  position: number;
  label: string;
  description: string;
  day_offset: number | null;
  trigger_type: string;
  flag: number | null;
}

interface RawLoad {
  id: string;
  campaign_id: string;
  load_date: string;
  deadline: string | null;
  title: string | null;
  asana_url: string | null;
  notes: string | null;
  status: string;
  created_at: string;
  ended_at: string | null;
}

const mapDefinition = (r: RawDefinition): CampaignDefinition => ({
  id: r.id,
  name: r.name,
  accentColor: r.accent_color,
  defaultDurationDays: r.default_duration_days,
  active: r.active,
  sortOrder: r.sort_order,
});

const mapMilestone = (r: RawMilestone): CampaignMilestone => ({
  id: r.id,
  campaignId: r.campaign_id,
  position: r.position,
  label: r.label,
  description: r.description,
  dayOffset: r.day_offset,
  triggerType: (["time", "event", "manual"] as const).includes(
    r.trigger_type as MilestoneTriggerType,
  )
    ? (r.trigger_type as MilestoneTriggerType)
    : "time",
  flag: r.flag,
});

const mapLoad = (r: RawLoad): CampaignLoad => ({
  id: r.id,
  campaignId: r.campaign_id,
  loadDate: new Date(r.load_date),
  deadline: r.deadline ? new Date(r.deadline) : null,
  title: r.title,
  asanaUrl: r.asana_url,
  notes: r.notes,
  status: (["active", "completed", "paused"] as const).includes(r.status as CampaignLoad["status"])
    ? (r.status as CampaignLoad["status"])
    : "active",
  createdAt: new Date(r.created_at),
  endedAt: r.ended_at ? new Date(r.ended_at) : null,
});

export async function listCampaignDefinitions(): Promise<CampaignDefinition[]> {
  try {
    const { data, error } = await client()
      .from("campaign_definitions")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return (data as RawDefinition[]).map(mapDefinition);
  } catch {
    return [];
  }
}

export async function listCampaignMilestones(): Promise<CampaignMilestone[]> {
  try {
    const { data, error } = await client()
      .from("campaign_milestones")
      .select("*")
      .order("campaign_id", { ascending: true })
      .order("position", { ascending: true });
    if (error || !data) return [];
    return (data as RawMilestone[]).map(mapMilestone);
  } catch {
    return [];
  }
}

export async function listCampaignLoads(
  opts: { status?: CampaignLoad["status"] | "all" } = {},
): Promise<CampaignLoad[]> {
  try {
    let q = client().from("campaign_loads").select("*").order("load_date", { ascending: false });
    if (opts.status && opts.status !== "all") q = q.eq("status", opts.status);
    const { data, error } = await q;
    if (error || !data) return [];
    return (data as RawLoad[]).map(mapLoad);
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Writes

export interface CreateLoadInput {
  campaignId: string;
  loadDate: Date;
  deadline?: Date | null;
  asanaUrl?: string | null;
  notes?: string | null;
}

export async function createCampaignLoad(input: CreateLoadInput): Promise<CampaignLoad> {
  const { data, error } = await client()
    .from("campaign_loads")
    .insert({
      campaign_id: input.campaignId,
      load_date: input.loadDate.toISOString(),
      deadline: input.deadline ? input.deadline.toISOString() : null,
      asana_url: input.asanaUrl ?? null,
      notes: input.notes ?? null,
      status: "active",
    })
    .select()
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  return mapLoad(data as RawLoad);
}

export interface UpdateLoadInput {
  loadDate?: Date;
  deadline?: Date | null;
  asanaUrl?: string | null;
  notes?: string | null;
  status?: CampaignLoad["status"];
}

export async function updateCampaignLoad(id: string, patch: UpdateLoadInput): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.loadDate) update.load_date = patch.loadDate.toISOString();
  if (patch.deadline !== undefined)
    update.deadline = patch.deadline ? patch.deadline.toISOString() : null;
  if (patch.asanaUrl !== undefined) update.asana_url = patch.asanaUrl;
  if (patch.notes !== undefined) update.notes = patch.notes;
  if (patch.status !== undefined) {
    update.status = patch.status;
    if (patch.status !== "active") update.ended_at = new Date().toISOString();
  }
  if (Object.keys(update).length === 0) return;
  const { error } = await client().from("campaign_loads").update(update).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteCampaignLoad(id: string): Promise<void> {
  const { error } = await client().from("campaign_loads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface UpsertMilestoneInput {
  id?: string;
  campaignId: string;
  position: number;
  label: string;
  description?: string;
  dayOffset?: number | null;
  triggerType?: MilestoneTriggerType;
  flag?: number | null;
}

export async function upsertCampaignMilestone(input: UpsertMilestoneInput): Promise<void> {
  const row = {
    id: input.id,
    campaign_id: input.campaignId,
    position: input.position,
    label: input.label,
    description: input.description ?? "",
    day_offset: input.dayOffset ?? null,
    trigger_type: input.triggerType ?? "time",
    flag: input.flag ?? null,
    updated_at: new Date().toISOString(),
  };
  // Strip undefined id so the DB defaults to gen_random_uuid() for inserts.
  if (!row.id) {
    const { id: _id, ...withoutId } = row;
    void _id;
    const { error } = await client().from("campaign_milestones").insert(withoutId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await client().from("campaign_milestones").upsert(row);
  if (error) throw new Error(error.message);
}

export async function deleteCampaignMilestone(id: string): Promise<void> {
  const { error } = await client().from("campaign_milestones").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
