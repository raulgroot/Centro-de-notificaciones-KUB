/**
 * Supabase adapter for documentation flows.
 *
 * Flows are educational walkthroughs of HSBC customer journeys — e.g. the
 * "Redirección" flow that documents what the cardholder sees from SMS to
 * email confirmation. Same Supabase REST path as the rest of the app
 * (HTTPS / PostgREST) so we don't depend on Direct Postgres reachability.
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

export interface FlowRule {
  category: string;
  items: string[];
}

export interface Flow {
  id: string;
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  accentColor: string;
  rules: FlowRule[];
  active: boolean;
  sortOrder: number;
}

export interface FlowStep {
  id: string;
  flowId: string;
  position: number;
  title: string;
  description: string | null;
  keyPoints: string[];
  userAction: string | null;
  mockupImageUrl: string | null;
  mockupHtml: string | null;
}

interface RawFlow {
  id: string;
  slug: string | null;
  name: string;
  subtitle: string | null;
  description: string | null;
  accent_color: string | null;
  rules: FlowRule[] | null;
  active: boolean;
  sort_order: number;
}

interface RawFlowStep {
  id: string;
  flow_id: string;
  position: number;
  title: string;
  description: string | null;
  key_points: string[] | null;
  user_action: string | null;
  mockup_image_url: string | null;
  mockup_html: string | null;
}

const mapFlow = (r: RawFlow): Flow => ({
  id: r.id,
  slug: r.slug ?? r.id,
  name: r.name,
  subtitle: r.subtitle,
  description: r.description,
  accentColor: r.accent_color ?? "#DB0011",
  rules: r.rules ?? [],
  active: r.active,
  sortOrder: r.sort_order,
});

const mapStep = (r: RawFlowStep): FlowStep => ({
  id: r.id,
  flowId: r.flow_id,
  position: r.position,
  title: r.title,
  description: r.description,
  keyPoints: r.key_points ?? [],
  userAction: r.user_action,
  mockupImageUrl: r.mockup_image_url,
  mockupHtml: r.mockup_html,
});

export async function listFlows(): Promise<Flow[]> {
  try {
    const { data, error } = await client()
      .from("flows")
      .select("*")
      .eq("active", true)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return (data as RawFlow[]).map(mapFlow);
  } catch {
    return [];
  }
}

export async function getFlowBySlug(
  slug: string,
): Promise<{ flow: Flow; steps: FlowStep[] } | null> {
  try {
    const { data: flowData, error: flowErr } = await client()
      .from("flows")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (flowErr || !flowData) return null;

    const flow = mapFlow(flowData as RawFlow);

    const { data: stepData } = await client()
      .from("flow_steps")
      .select("*")
      .eq("flow_id", flow.id)
      .order("position", { ascending: true });

    const steps = (stepData ?? []).map((s) => mapStep(s as RawFlowStep));
    return { flow, steps };
  } catch {
    return null;
  }
}
