"use server";

import { revalidatePath } from "next/cache";
import {
  createCampaignLoad,
  updateCampaignLoad,
  deleteCampaignLoad,
  upsertCampaignMilestone,
  deleteCampaignMilestone,
  type MilestoneTriggerType,
  type CampaignLoad,
} from "@/lib/adapters/supabase/campaigns";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Server action: create a new campaign load (carga). */
export async function createLoadAction(formData: FormData): Promise<ActionResult> {
  const campaignId = String(formData.get("campaignId") ?? "").trim();
  const loadDateStr = String(formData.get("loadDate") ?? "").trim();
  const deadlineStr = String(formData.get("deadline") ?? "").trim();
  const asanaUrl = String(formData.get("asanaUrl") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!campaignId) return { ok: false, error: "Falta la campaña." };
  if (!loadDateStr) return { ok: false, error: "Falta la fecha de carga." };

  const loadDate = new Date(loadDateStr + "T00:00:00Z");
  if (Number.isNaN(loadDate.getTime())) return { ok: false, error: "Fecha de carga inválida." };

  const deadline = deadlineStr ? new Date(deadlineStr + "T00:00:00Z") : null;
  if (deadline && Number.isNaN(deadline.getTime()))
    return { ok: false, error: "Fecha límite inválida." };

  try {
    await createCampaignLoad({
      campaignId,
      loadDate,
      deadline,
      asanaUrl: asanaUrl || null,
      notes: notes || null,
    });
    revalidatePath("/campanas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/** Server action: update an existing load's status or fields. */
export async function updateLoadAction(
  id: string,
  patch: { status?: CampaignLoad["status"]; notes?: string },
): Promise<ActionResult> {
  try {
    await updateCampaignLoad(id, patch);
    revalidatePath("/campanas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/** Server action: delete a load (irreversible). */
export async function deleteLoadAction(id: string): Promise<ActionResult> {
  try {
    await deleteCampaignLoad(id);
    revalidatePath("/campanas");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/** Server action: upsert a milestone definition. */
export async function upsertMilestoneAction(input: {
  id?: string;
  campaignId: string;
  position: number;
  label: string;
  description?: string;
  dayOffset?: number | null;
  triggerType?: MilestoneTriggerType;
  flag?: number | null;
}): Promise<ActionResult> {
  if (!input.campaignId || !input.label) return { ok: false, error: "Falta campaña o label." };
  try {
    await upsertCampaignMilestone(input);
    revalidatePath("/campanas");
    revalidatePath("/campanas/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}

/** Server action: delete a milestone definition. */
export async function deleteMilestoneAction(id: string): Promise<ActionResult> {
  try {
    await deleteCampaignMilestone(id);
    revalidatePath("/campanas");
    revalidatePath("/campanas/admin");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error desconocido" };
  }
}
