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
  improveTopic,
  refineField,
  suggestBanner,
  suggestSmartBanner,
  type NotificationCopy,
  type SmartBannerSuggestion,
} from "@/lib/ai/notification-copy";
import { searchHeroImages, type FreepikImage } from "@/lib/adapters/freepik/client";
import {
  searchHeroImages as searchUnsplash,
  type UnsplashImage,
} from "@/lib/adapters/unsplash/client";
import {
  generateImages as generateImagesViaGemini,
  generateImagesForVariations,
  type GeneratedImage,
} from "@/lib/adapters/google-genai/client";
import { buildImagePromptVariations } from "@/lib/notifications/image-prompt";
import {
  extractBriefFromFile,
  inferMediaType,
  EXTRACT_ALLOWED_MIME,
  MAX_EXTRACT_FILE_BYTES,
  type ExtractedBrief,
} from "@/lib/ai/extract-brief";
import { createDraft, deleteDraft, updateDraft } from "@/lib/adapters/supabase/notification-drafts";
import { renderEmailHtml } from "@/lib/notifications/template";
import type {
  DraftBanner,
  DraftBannerStyle,
  DraftBrief,
  DraftCopy,
  DraftCopyTextField,
  DraftHeroImage,
} from "@/lib/db/schema";

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
  // We need the product key to pick the right top header art (HSBC+VIVA
  // for Viva/Plus, HSBC-only otherwise). The brief is the source of truth.
  const renderedHtml =
    args.copy || args.heroImage !== undefined
      ? renderEmailHtml({
          copy: args.copy ?? {},
          heroImage: args.heroImage ?? null,
          product: args.brief?.product,
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

/** Mejora la redacción del "topic" del wizard con IA (sin inventar datos). */
export async function improveTopicAction(args: {
  topic: string;
  brief: DraftBrief;
}): Promise<string> {
  return improveTopic(args);
}

/** Refine one field with a natural-language instruction. */
export async function refineFieldAction(args: {
  field: DraftCopyTextField;
  current: string;
  instruction: string;
  brief: DraftBrief;
}): Promise<string> {
  return refineField(args);
}

/** Search Freepik for hero candidates. Mantenido por compat con UI vieja. */
export async function searchImagesAction(query: string): Promise<FreepikImage[]> {
  return searchHeroImages({ query });
}

/**
 * Search Unsplash. Reemplaza Freepik en el wizard. Devuelve un array vacío
 * en lugar de tirar si Unsplash falla — la UI ya tiene fallback a upload
 * o copiar prompt, no queremos bloquear al usuario por un proveedor.
 */
export async function searchUnsplashAction(query: string): Promise<UnsplashImage[]> {
  try {
    return await searchUnsplash({ query });
  } catch (e) {
    // Logueamos pero no propagamos — el UI mostrará lista vacía + el
    // usuario puede usar las otras 2 opciones (upload o prompt).
    console.error("[unsplash] search failed:", e instanceof Error ? e.message : e);
    throw e;
  }
}

/**
 * Genera N imágenes con Google Gemini ("Nano Banana") directamente desde
 * el wizard. El prompt viene pre-armado por buildImagePrompt y respeta
 * las reglas de marca HSBC (rojo, sin contacto visual, sonrisa genuina,
 * cuadrantes 1-2, 16:9).
 */
export async function generateImagesAction(args: {
  prompt: string;
  count?: number;
}): Promise<GeneratedImage[]> {
  return generateImagesViaGemini(args);
}

/**
 * Genera UNA imagen por cada una de las 2 variaciones del prompt
 * (editorial, contextual). Sirviendo al wizard con "2 opciones
 * para elegir, cada una con un look distinto". Construye los prompts
 * server-side desde el brief y delega al adapter de Gemini.
 */
export async function generateImageVariationsAction(args: {
  brief: DraftBrief;
}): Promise<GeneratedImage[]> {
  const variations = buildImagePromptVariations(args.brief);
  return generateImagesForVariations({
    variations: variations.map((v) => ({
      id: v.id,
      name: v.name,
      prompt: v.prompt,
    })),
  });
}

/**
 * Extrae el brief desde un archivo subido (imagen, PDF o texto). El wizard
 * manda un FormData con `file`; validamos tipo y tamaño aquí (borde) antes
 * de pasar los bytes a la lib de IA. Devuelve topic redactado + keyInfoTags
 * pre-llenados que el cliente mergea sobre el brief actual.
 */
export async function extractBriefFromFileAction(formData: FormData): Promise<ExtractedBrief> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No llegó ningún archivo.");
  }
  if (file.size > MAX_EXTRACT_FILE_BYTES) {
    const mb = (file.size / (1024 * 1024)).toFixed(1);
    throw new Error(`El archivo pesa ${mb} MB. El máximo es 8 MB.`);
  }
  const mediaType = inferMediaType(file.name, file.type);
  if (!(EXTRACT_ALLOWED_MIME as readonly string[]).includes(mediaType)) {
    throw new Error(
      "Formato no soportado. Acepto imágenes (PNG/JPG/WebP/GIF), PDF, PowerPoint (.pptx) o texto (.txt/.md/.csv).",
    );
  }
  const data = new Uint8Array(await file.arrayBuffer());
  return extractBriefFromFile({ data, mediaType, filename: file.name });
}

/**
 * Sugiere el contenido de un banner desde el brief (estilo elegido por el
 * usuario). El cliente lo mergea en `copy.banner` y el preview re-renderea.
 */
export async function suggestBannerAction(args: {
  brief: DraftBrief;
  style: DraftBannerStyle;
}): Promise<DraftBanner> {
  return suggestBanner(args);
}

/**
 * Sugerencia automática: la IA analiza el brief, elige el estilo de banner
 * más coherente y llena el contenido. El usuario acepta o descarta.
 */
export async function suggestSmartBannerAction(brief: DraftBrief): Promise<SmartBannerSuggestion> {
  return suggestSmartBanner(brief);
}

/** Delete a draft and bounce back to the list. */
export async function deleteDraftAction(id: string): Promise<void> {
  await deleteDraft(id);
  revalidatePath("/creation");
  redirect("/creation");
}
