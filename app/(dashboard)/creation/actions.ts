"use server";

/**
 * Server actions for the /creation wizard. Thin glue around the AI / Freepik
 * libs + the Supabase drafts repo. Each action is independently callable
 * from a Client Component via the React Action mechanism.
 *
 * All actions revalidate the affected route(s) so the editor sees fresh data
 * after a save.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  generateNotificationCopy,
  refineField,
  type NotificationCopy,
} from "@/lib/ai/notification-copy";
import { searchHeroImages, type FreepikImage } from "@/lib/adapters/freepik/client";
import { createDraft, deleteDraft, updateDraft } from "@/lib/adapters/supabase/notification-drafts";
import { renderEmailHtml } from "@/lib/notifications/template";
import type { DraftBrief, DraftCopy, DraftHeroImage } from "@/lib/db/schema";

/** Create a new empty draft and jump straight into the editor. */
export async function createDraftAndOpenAction(formData: FormData): Promise<void> {
  const name = String(formData.get("name") ?? "Sin nombre");
  const baseTemplateId = (formData.get("baseTemplateId") as string) || null;
  const draft = await createDraft({ name, baseTemplateId });
  revalidatePath("/creation");
  redirect(`/creation/${draft.id}`);
}

/** Update brief + (optional) copy / heroImage / name. Re-renders HTML. */
export async function saveDraftAction(args: {
  id: string;
  name?: string;
  brief?: DraftBrief;
  copy?: DraftCopy;
  heroImage?: DraftHeroImage | null;
}): Promise<void> {
  const renderedHtml =
    args.copy || args.heroImage !== undefined
      ? renderEmailHtml({
          copy: args.copy ?? {},
          heroImage: args.heroImage ?? null,
        })
      : undefined;
  await updateDraft(args.id, {
    ...(args.name !== undefined && { name: args.name }),
    ...(args.brief !== undefined && { brief: args.brief }),
    ...(args.copy !== undefined && { copy: args.copy }),
    ...(args.heroImage !== undefined && { heroImage: args.heroImage }),
    ...(renderedHtml !== undefined && { renderedHtml }),
  });
  revalidatePath(`/creation/${args.id}`);
  revalidatePath("/creation");
}

/** Call Claude with the brief; return a fresh structured copy bundle. */
export async function generateCopyAction(brief: DraftBrief): Promise<NotificationCopy> {
  return generateNotificationCopy(brief);
}

/** Refine one field with a natural-language instruction. */
export async function refineFieldAction(args: {
  field: keyof DraftCopy;
  current: string;
  instruction: string;
  brief: DraftBrief;
}): Promise<string> {
  return refineField(args);
}

/** Search Freepik for hero candidates. */
export async function searchImagesAction(query: string): Promise<FreepikImage[]> {
  return searchHeroImages({ query });
}

/** Delete a draft and bounce back to the list. */
export async function deleteDraftAction(id: string): Promise<void> {
  await deleteDraft(id);
  revalidatePath("/creation");
  redirect("/creation");
}
