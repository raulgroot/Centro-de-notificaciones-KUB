/**
 * Supabase-backed repository for notification drafts.
 *
 * HTTPS / PostgREST only (same reasoning as everywhere else: Vercel can't
 * reach the Supabase Postgres endpoint on free-tier IPv6, but the REST API
 * is always reachable).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdminEnv } from "@/lib/env";
import type { DraftBrief, DraftCopy, DraftHeroImage } from "@/lib/db/schema";

let _client: SupabaseClient | null = null;
function client(): SupabaseClient {
  if (_client) return _client;
  const env = supabaseAdminEnv();
  _client = createClient(env.url, env.serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export type DraftStatus = "draft" | "shared" | "archived";

export interface NotificationDraft {
  id: string;
  name: string;
  baseTemplateId: string | null;
  brief: DraftBrief;
  copy: DraftCopy;
  heroImage: DraftHeroImage | null;
  renderedHtml: string | null;
  status: DraftStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface DraftRow {
  id: string;
  name: string;
  base_template_id: string | null;
  brief: DraftBrief;
  copy: DraftCopy;
  hero_image: DraftHeroImage | null;
  rendered_html: string | null;
  status: DraftStatus;
  created_at: string;
  updated_at: string;
}

const mapRow = (r: DraftRow): NotificationDraft => ({
  id: r.id,
  name: r.name,
  baseTemplateId: r.base_template_id,
  brief: r.brief ?? {},
  copy: r.copy ?? {},
  heroImage: r.hero_image ?? null,
  renderedHtml: r.rendered_html,
  status: r.status,
  createdAt: new Date(r.created_at),
  updatedAt: new Date(r.updated_at),
});

export async function listDrafts(args?: { status?: DraftStatus }): Promise<NotificationDraft[]> {
  let q = client()
    .from("notification_drafts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(200);
  if (args?.status) q = q.eq("status", args.status);
  const { data, error } = await q;
  if (error) throw new Error(`listDrafts: ${error.message}`);
  return (data as unknown as DraftRow[]).map(mapRow);
}

export async function getDraft(id: string): Promise<NotificationDraft | null> {
  const { data, error } = await client()
    .from("notification_drafts")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getDraft: ${error.message}`);
  return data ? mapRow(data as unknown as DraftRow) : null;
}

export async function createDraft(input: {
  name: string;
  baseTemplateId?: string | null;
  brief?: DraftBrief;
}): Promise<NotificationDraft> {
  const { data, error } = await client()
    .from("notification_drafts")
    .insert({
      name: input.name,
      base_template_id: input.baseTemplateId ?? null,
      brief: input.brief ?? {},
    })
    .select("*")
    .single();
  if (error) throw new Error(`createDraft: ${error.message}`);
  return mapRow(data as unknown as DraftRow);
}

export async function updateDraft(
  id: string,
  patch: Partial<{
    name: string;
    brief: DraftBrief;
    copy: DraftCopy;
    heroImage: DraftHeroImage | null;
    renderedHtml: string | null;
    status: DraftStatus;
  }>,
): Promise<NotificationDraft> {
  const dbPatch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.name !== undefined) dbPatch.name = patch.name;
  if (patch.brief !== undefined) dbPatch.brief = patch.brief;
  if (patch.copy !== undefined) dbPatch.copy = patch.copy;
  if (patch.heroImage !== undefined) dbPatch.hero_image = patch.heroImage;
  if (patch.renderedHtml !== undefined) dbPatch.rendered_html = patch.renderedHtml;
  if (patch.status !== undefined) dbPatch.status = patch.status;

  const { data, error } = await client()
    .from("notification_drafts")
    .update(dbPatch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw new Error(`updateDraft: ${error.message}`);
  return mapRow(data as unknown as DraftRow);
}

export async function deleteDraft(id: string): Promise<void> {
  const { error } = await client().from("notification_drafts").delete().eq("id", id);
  if (error) throw new Error(`deleteDraft: ${error.message}`);
}
