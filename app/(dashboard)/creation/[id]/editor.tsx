"use client";

/**
 * Three-column editor for a notification draft.
 *
 *   Brief (left)            Copy (center)          Preview (right)
 *   ─────────────           ─────────────          ─────────────
 *   producto                subject                live iframe of
 *   movement                preheader              the rendered
 *   lifecycle               headline               HSBC email
 *   audience                body
 *   tono                    cta_label              ↻ updates on
 *   contexto extra          sms                    every change
 *
 *   [✨ Generar copy]       [✨ Refinar campo]     [🖼 Imagen]
 *
 * Auto-saves on every meaningful change (debounced 1s) via server action.
 * Renders the HTML preview client-side from the same template module the
 * server uses, so what you see is what gets saved.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  extractBriefFromFileAction,
  generateCopyAction,
  generateImageVariationsAction,
  improveTopicAction,
  refineFieldAction,
  saveDraftAction,
  searchImagesAction,
  searchUnsplashAction,
} from "../actions";
import type { NotificationDraft } from "@/lib/adapters/supabase/notification-drafts";
import type { DraftBrief, DraftCopy, DraftHeroImage, DraftKeyInfo } from "@/lib/db/schema";
import { renderEmailHtml } from "@/lib/notifications/template";
import type { FreepikImage } from "@/lib/adapters/freepik/client";
import type { UnsplashImage } from "@/lib/adapters/unsplash/client";
import type { GeneratedImage } from "@/lib/adapters/google-genai/client";
import { buildImagePromptVariations, type PromptVariation } from "@/lib/notifications/image-prompt";
import { runPreflight, type PreflightResult } from "@/lib/notifications/premier-check";
import { PILLAR_ORDER, PILLARS, type PillarId } from "@/lib/notifications/premier-rules";
import { PreflightPanel } from "./preflight-panel";
import {
  UNIVERS_NEXT_REGULAR_WOFF2,
  UNIVERS_NEXT_MEDIUM_WOFF2,
  UNIVERS_NEXT_BOLD_WOFF2,
} from "@/lib/notifications/univers-font";
import {
  ArrowLeft,
  ArrowRight,
  FileUp,
  ImageIcon,
  Loader2,
  Pencil,
  Presentation,
  ShieldCheck,
  Sparkles,
  Upload,
  Wand2,
  X,
} from "lucide-react";

/** Max raw size for an uploaded hero image. ~3MB keeps the data URL under
 * ~4MB after base64, which jsonb in Supabase tolerates without complaints. */
const MAX_HERO_UPLOAD_BYTES = 3 * 1024 * 1024;
const ALLOWED_HERO_MIME = ["image/png", "image/jpeg", "image/webp"] as const;

/** Límite y tipos para el archivo de contexto del brief (extracción con IA).
 * Espejo de EXTRACT_ALLOWED_MIME/MAX_EXTRACT_FILE_BYTES en lib/ai/extract-brief
 * — duplicado a propósito: importar esa lib aquí metería el SDK de IA al
 * bundle del cliente. El server action re-valida de todos modos. */
const MAX_EXTRACT_BYTES = 8 * 1024 * 1024;
const EXTRACT_ACCEPT = ".pdf,.pptx,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv";

/** Products that have an official HSBC card icon under /public/cards/. */
const PRODUCTS = [
  { id: "viva", label: "Viva", icon: "/cards/viva.png" },
  { id: "vivaplus", label: "Viva Plus", icon: "/cards/vivaplus.png" },
  { id: "2now", label: "2Now", icon: "/cards/2now.png" },
  { id: "advance", label: "Advance", icon: "/cards/advance.png" },
  { id: "air", label: "Air", icon: "/cards/air.png" },
  { id: "premier", label: "World Elite", icon: "/cards/premier.png" },
  { id: "clasica", label: "Clásica", icon: "/cards/clasica.png" },
  { id: "zero", label: "Zero", icon: "/cards/zero.png" },
] as const;

const OBJECTIVES = [
  { id: "activar", label: "Activar", help: "Que active la tarjeta o un servicio." },
  { id: "verificar", label: "Verificar", help: "Que confirme datos o una transacción." },
  { id: "informar", label: "Informar", help: "Avisarle de un cambio o actualización." },
  { id: "recordar", label: "Recordar", help: "Recordarle una acción pendiente." },
  { id: "agradecer", label: "Agradecer", help: "Reconocer su lealtad o compra." },
  { id: "bienvenida", label: "Dar bienvenida", help: "Recibirlo a un nuevo producto." },
] as const;

const AUDIENCES = [
  { id: "todos", label: "Todos", help: "Audiencia mixta, lenguaje universal." },
  { id: "nuevos", label: "Nuevos", help: "Primer mes con HSBC, sin asumir conocimiento previo." },
  {
    id: "recurrentes",
    label: "Recurrentes",
    help: "Clientes con historial, familiares con la marca.",
  },
  { id: "vip", label: "VIP / World Elite", help: "Tono más sobrio y premium." },
  { id: "morosos", label: "Con adeudo", help: "Firme pero respetuoso." },
] as const;

const URGENCIES = [
  { id: "baja", label: "Baja", help: "Informativo, sin presión." },
  { id: "media", label: "Media", help: "Llamada a la acción clara, sin alarmar." },
  { id: "alta", label: "Alta", help: "Acción inmediata, enfatiza tiempos." },
] as const;

// Antes había una constante TONES con 5 opciones (informativo / cercano /
// celebratorio / urgente / formal). El paso fue removido del wizard: el AI
// ahora infiere el tono de objetivo + audiencia + urgencia, lo que reduce
// fricción. Si en algún momento queremos reintroducirlo, agrégalo de vuelta
// como un step opcional y un campo en DraftBrief.

type CopyField = keyof DraftCopy;

/**
 * The wizard's ordered list of steps. `required` controls whether the user
 * can skip to the next step.
 *
 * Cambios respecto al wizard original:
 *   - `keyInfo` ahora usa chips multi-select (terminación de tarjeta,
 *     monto, fecha límite, rango de fechas, URL/código promo).
 *   - Se quitó el paso `tone` — el AI lo infiere de objetivo + audiencia
 *     + urgencia, y reduce fricción en el wizard.
 *   - Se agregó `image` al final para que llegues al editor con la pieza
 *     ya completa (en vez de tener que ir a buscar la imagen aparte).
 */
const WIZARD_STEPS = [
  { id: "product", required: true },
  { id: "objective", required: true },
  { id: "topic", required: true },
  { id: "keyInfo", required: false },
  { id: "audience", required: true },
  { id: "urgency", required: true },
  { id: "image", required: false },
] as const;

type WizardStepId = (typeof WIZARD_STEPS)[number]["id"];

/** Is the field at `step` filled enough to advance? */
function isStepValid(brief: DraftBrief, step: WizardStepId): boolean {
  switch (step) {
    case "product":
      return Boolean(brief.product);
    case "objective":
      return Boolean(brief.objective);
    case "topic":
      return Boolean(brief.topic && brief.topic.trim().length >= 10);
    case "keyInfo":
      return true; // optional — chips multi-select
    case "audience":
      return Boolean(brief.audience);
    case "urgency":
      return Boolean(brief.urgency);
    case "image":
      return true; // optional — el usuario puede llegar al editor sin imagen
    default:
      return false;
  }
}

/** Has the brief been filled enough to be generated? (all required steps pass) */
function isBriefComplete(b: DraftBrief): boolean {
  return WIZARD_STEPS.filter((s) => s.required).every((s) => isStepValid(b, s.id));
}

export function DraftEditor({ draft }: { draft: NotificationDraft }) {
  const [brief, setBrief] = useState<DraftBrief>(draft.brief);
  const [copy, setCopy] = useState<DraftCopy>(draft.copy);
  const [heroImage, setHeroImage] = useState<DraftHeroImage | null>(draft.heroImage);
  const [busy, setBusy] = useState<{
    generate?: boolean;
    refine?: CopyField;
    search?: boolean;
    upload?: boolean;
    improveTopic?: boolean;
    extract?: boolean;
    download?: "image" | "presentation";
  }>({});
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const extractInputRef = useRef<HTMLInputElement>(null);
  // Resultado de la última extracción de archivo, para mostrar "qué sacó"
  // (nombre, resumen del doc y qué chips se llenaron) debajo del dropzone.
  const [lastExtract, setLastExtract] = useState<{
    filename: string;
    summary: string;
    filledTags: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageQuery, setImageQuery] = useState<string>("");
  const [imageResults, setImageResults] = useState<FreepikImage[]>([]);
  const [isPending, startTransition] = useTransition();

  // Brief collapses automatically when there's already generated copy (i.e.,
  // the user has gone through the first generation). They can re-open it
  // anytime to tweak the inputs.
  const [briefOpen, setBriefOpen] = useState<boolean>(!draft.copy.subject);
  // Toggle de preview dark mode. Por default light (que es como llega el
  // email al cliente). Útil para verificar legibilidad si el cliente tiene
  // dark mode forzado en su mail app.
  const [previewDark, setPreviewDark] = useState<boolean>(false);

  // Pre-flight Premier: el panel se abre bajo demanda (botón "Revisar"), y la
  // validación corre sobre el copy ya generado/editado (no por carácter).
  const [preflight, setPreflight] = useState<PreflightResult | null>(null);

  // Wizard step index. When re-opening the brief after a generation we jump
  // straight to the last step so the user can review/regenerate without
  // clicking "Siguiente" five times.
  const [stepIdx, setStepIdx] = useState<number>(draft.copy.subject ? WIZARD_STEPS.length - 1 : 0);
  // `stepIdx` is always clamped to a valid range by setStepIdx, but TS
  // strict needs the non-null assertion for tuple indexing.
  const currentStep = WIZARD_STEPS[stepIdx]!;
  const isLastStep = stepIdx === WIZARD_STEPS.length - 1;
  const canAdvance = isStepValid(brief, currentStep.id);

  // Track whether the "Otro" (custom text) option is selected on the
  // objective/audience steps. Derived from the draft on first render: if the
  // stored value isn't in the preset list, the user must have typed it.
  const [otherMode, setOtherMode] = useState<{
    objective: boolean;
    audience: boolean;
  }>(() => ({
    objective: Boolean(brief.objective && !OBJECTIVES.some((o) => o.id === brief.objective)),
    audience: Boolean(brief.audience && !AUDIENCES.some((a) => a.id === brief.audience)),
  }));

  // Re-render the email preview on any change to copy / hero / product
  // (the brand header is product-aware: Viva → HSBC+VIVA art, else
  // HSBC-only logo).
  const previewHtml = useMemo(
    () => renderEmailHtml({ copy, heroImage, product: brief.product }),
    [copy, heroImage, brief.product],
  );

  // Auto-save debounced. The ref shadows the latest state so the setTimeout
  // callback doesn't capture stale values; updated in a layout-safe effect
  // (mutating refs during render is a React 19 lint error).
  const stateRef = useRef({ brief, copy, heroImage });
  useEffect(() => {
    stateRef.current = { brief, copy, heroImage };
  }, [brief, copy, heroImage]);
  useEffect(() => {
    const t = setTimeout(() => {
      const s = stateRef.current;
      startTransition(() => {
        saveDraftAction({
          id: draft.id,
          brief: s.brief,
          copy: s.copy,
          heroImage: s.heroImage,
        }).catch((e) => setError(String(e)));
      });
    }, 800);
    return () => clearTimeout(t);
  }, [brief, copy, heroImage, draft.id]);

  function onReview() {
    setPreflight(
      runPreflight({
        copy,
        isPremier: Boolean(brief.isPremier),
        pillar: brief.premierPillar ?? null,
      }),
    );
  }

  async function onGenerate() {
    setBusy((b) => ({ ...b, generate: true }));
    setError(null);
    try {
      const generated = await generateCopyAction(brief);
      setCopy(generated);
      // Once Claude succeeds, fold the brief out of the way so copy + preview
      // get the full screen. User can still click "Editar brief" to re-open.
      setBriefOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la generación de copy.");
    } finally {
      setBusy((b) => ({ ...b, generate: false }));
    }
  }

  async function onRefine(field: CopyField, instruction: string) {
    const current = copy[field] ?? "";
    setBusy((b) => ({ ...b, refine: field }));
    setError(null);
    try {
      const next = await refineFieldAction({ field, current, instruction, brief });
      setCopy((c) => ({ ...c, [field]: next }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló el refinamiento.");
    } finally {
      setBusy((b) => ({ ...b, refine: undefined }));
    }
  }

  // Selección + auto-avance para pasos de opción ÚNICA (producto, objetivo,
  // audiencia, urgencia). Al hacer click en una opción, pasamos solos al
  // siguiente paso tras un pequeño delay (para que se vea el highlight de la
  // selección). Los pasos de texto libre y chips multi-select NO auto-avanzan.
  function selectAndAdvance(patch: Partial<DraftBrief>) {
    setBrief((b) => ({ ...b, ...patch }));
    window.setTimeout(() => {
      setStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1));
    }, 200);
  }

  async function onImproveTopic() {
    const current = (brief.topic ?? "").trim();
    if (current.length < 3) return;
    setBusy((b) => ({ ...b, improveTopic: true }));
    setError(null);
    try {
      const improved = await improveTopicAction({ topic: current, brief });
      if (improved) setBrief((b) => ({ ...b, topic: improved }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la mejora del texto con IA.");
    } finally {
      setBusy((b) => ({ ...b, improveTopic: false }));
    }
  }

  async function onImageSearch() {
    const q = imageQuery.trim();
    if (!q) return;
    setBusy((b) => ({ ...b, search: true }));
    setError(null);
    try {
      const r = await searchImagesAction(q);
      setImageResults(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la búsqueda de imágenes.");
    } finally {
      setBusy((b) => ({ ...b, search: false }));
    }
  }

  function pickImage(img: FreepikImage) {
    setHeroImage({
      url: img.url,
      alt: img.title,
      source: "freepik",
      freepikId: img.id,
      query: imageQuery,
    });
  }

  /**
   * Read a user-selected file as a data URL so we can embed it directly in
   * the rendered HTML / PDF without needing an external host. This is the
   * fallback when Freepik is unavailable or the user wants to bring their
   * own asset. Stored under source:"upload" in the draft.
   */
  async function onUploadFile(file: File) {
    if (!ALLOWED_HERO_MIME.includes(file.type as (typeof ALLOWED_HERO_MIME)[number])) {
      setError("Solo se aceptan imágenes PNG, JPG o WebP.");
      return;
    }
    if (file.size > MAX_HERO_UPLOAD_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`La imagen pesa ${mb} MB. El máximo es 3 MB.`);
      return;
    }

    setBusy((b) => ({ ...b, upload: true }));
    setError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("No pude leer el archivo."));
        reader.readAsDataURL(file);
      });
      setHeroImage({
        url: dataUrl,
        alt: file.name.replace(/\.[^.]+$/, ""),
        source: "upload",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la carga de la imagen.");
    } finally {
      setBusy((b) => ({ ...b, upload: false }));
      // Reset the input so the same file can be re-selected after removing it.
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  /**
   * Extrae el brief desde un archivo (foto, PDF o texto). Manda el archivo
   * al server action, y mergea el resultado SOBRE lo que el usuario ya
   * escribió: el topic extraído se agrega (no pisa) y los keyInfoTags solo
   * llenan campos vacíos — lo tecleado por el usuario siempre gana.
   */
  async function onExtractBriefFile(file: File) {
    if (file.size > MAX_EXTRACT_BYTES) {
      const mb = (file.size / (1024 * 1024)).toFixed(1);
      setError(`El archivo pesa ${mb} MB. El máximo es 8 MB.`);
      return;
    }
    setBusy((b) => ({ ...b, extract: true }));
    setError(null);
    setLastExtract(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await extractBriefFromFileAction(fd);
      // Merge fuera del updater (los updaters deben ser puros). stateRef
      // siempre trae el brief más reciente — mismo truco que el auto-save.
      const b = stateRef.current.brief;
      const currentTopic = (b.topic ?? "").trim();
      const topic = currentTopic ? `${currentTopic}\n\n${res.topic}` : res.topic;
      const tags: DraftKeyInfo = { ...b.keyInfoTags };
      const filledTags: string[] = [];
      const fillable = [
        ["cardEnding", "terminación"],
        ["amount", "monto"],
        ["deadline", "fecha límite"],
        ["dateRange", "rango de fechas"],
        ["promoUrl", "URL/código"],
      ] as const;
      for (const [key, label] of fillable) {
        if (res.keyInfoTags[key] && !tags[key]) {
          // TS no une bien el assignment indexado sobre union de keys;
          // el par key/valor siempre coincide porque vienen del mismo key.
          Object.assign(tags, { [key]: res.keyInfoTags[key] });
          filledTags.push(label);
        }
      }
      setBrief({ ...b, topic, keyInfoTags: tags });
      setLastExtract({ filename: file.name, summary: res.docSummary, filledTags });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pude extraer información del archivo.");
    } finally {
      setBusy((b) => ({ ...b, extract: false }));
      if (extractInputRef.current) extractInputRef.current.value = "";
    }
  }

  /**
   * Fetch the asset (PNG image or PDF deck) from /api/drafts/[id]/pdf and
   * trigger a browser download. We fetch + blob (instead of `window.location
   * = url`) so we can show a loading state and surface server errors as a
   * toast instead of leaving the user staring at a broken tab.
   */
  async function onDownload(mode: "image" | "presentation") {
    setBusy((b) => ({ ...b, download: mode }));
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/pdf?mode=${mode}`, {
        method: "GET",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error ?? "Falló la descarga.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Pull the filename out of Content-Disposition so we mirror what the
      // server chose (slugified draft name).
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const ext = mode === "image" ? "png" : "pdf";
      const filename = match?.[1] ?? `notificacion-${mode}.${ext}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la descarga.");
    } finally {
      setBusy((b) => ({ ...b, download: undefined }));
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Overlay creativo durante la generación. Cycla frases tipo "cocina"
          mientras Claude trabaja. */}
      <GeneratingOverlay visible={Boolean(busy.generate)} />

      {/* TOP BAR: brief wizard — conversational step-by-step (Claude-design style).
          Each step is its own focused screen with a big question, an answer
          input, and progress dots + back/next buttons.
          When closed it disappears completely and only a small "Editar brief"
          button remains in the toolbar so copy + preview get the full screen. */}
      {briefOpen && (
        <div className="relative flex-1 bg-gradient-to-b from-neutral-50/80 to-white">
          {/* Layout con positioning absoluto en lugar de flex-1+min-h-0.
              Intentamos varias variantes con flex pero el scroll seguía
              comportándose raro en algunos casos. Con `absolute inset-0`
              + `pb-24` (espacio para el footer) el navegador SIEMPRE permite
              el scroll cuando el contenido excede la altura visible. */}
          <div className="absolute inset-0 overflow-y-auto">
            <div className="mx-auto w-full max-w-3xl px-6 pt-8 pb-12">
              {/* Progress dots — clickable to jump back to any visited step. */}
              <div className="mb-6 flex items-center justify-center gap-1.5">
                {WIZARD_STEPS.map((s, i) => {
                  const filled = isStepValid(brief, s.id);
                  const current = i === stepIdx;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setStepIdx(i)}
                      aria-label={`Paso ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all ${
                        current
                          ? "bg-brand-600 w-8"
                          : filled
                            ? "bg-brand-600/40 hover:bg-brand-600/60 w-4"
                            : "w-4 bg-neutral-300 hover:bg-neutral-400"
                      }`}
                    />
                  );
                })}
              </div>

              {/* Current step content */}
              <div className="min-h-[160px]">
                {currentStep.id === "product" && (
                  <WizardStep
                    title="¿Para cuál tarjeta es esta notificación?"
                    hint="Determina el logo y los acentos visuales del email."
                  >
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      {PRODUCTS.map((p) => {
                        const active = brief.product === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => selectAndAdvance({ product: p.id })}
                            className={`group flex flex-col items-center gap-2 rounded-xl border p-3 text-sm font-medium transition ${
                              active
                                ? "border-brand-600 bg-brand-50 text-brand-700 ring-brand-600/15 ring-2"
                                : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.icon} alt="" className="h-10 w-16 object-contain" />
                            <span className="text-xs">{p.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </WizardStep>
                )}

                {currentStep.id === "objective" && (
                  <WizardStep
                    title="¿Qué quieres que haga el usuario?"
                    hint="Una acción concreta. Ancla el headline y el CTA."
                  >
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
                      {OBJECTIVES.map((o) => {
                        const active = brief.objective === o.id && !otherMode.objective;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setOtherMode((m) => ({ ...m, objective: false }));
                              selectAndAdvance({ objective: o.id });
                            }}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-brand-600 bg-brand-50 ring-brand-600/15 ring-2"
                                : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            <span
                              className={`text-sm font-semibold ${active ? "text-brand-700" : "text-neutral-900"}`}
                            >
                              {o.label}
                            </span>
                            <span className="text-[11px] leading-tight text-neutral-500">
                              {o.help}
                            </span>
                          </button>
                        );
                      })}
                      {/* "Otro" — toggles inline text input. When active, brief.objective
                        holds the free-form text the user types. */}
                      <button
                        type="button"
                        onClick={() => {
                          setOtherMode((m) => ({ ...m, objective: true }));
                          // Clear stored id if user came from a preset.
                          if (brief.objective && OBJECTIVES.some((o) => o.id === brief.objective)) {
                            setBrief({ ...brief, objective: "" });
                          }
                        }}
                        className={`flex flex-col items-start gap-1 rounded-xl border border-dashed p-3 text-left transition ${
                          otherMode.objective
                            ? "border-brand-600 bg-brand-50 ring-brand-600/15 ring-2"
                            : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
                        }`}
                      >
                        <span
                          className={`text-sm font-semibold ${otherMode.objective ? "text-brand-700" : "text-neutral-900"}`}
                        >
                          Otro
                        </span>
                        <span className="text-[11px] leading-tight text-neutral-500">
                          Describe el objetivo a tu manera.
                        </span>
                      </button>
                    </div>
                    {otherMode.objective && (
                      <input
                        autoFocus
                        type="text"
                        value={brief.objective ?? ""}
                        onChange={(e) => setBrief({ ...brief, objective: e.target.value })}
                        placeholder="Ej. Avisar que la tarjeta llega un día tarde por contingencia."
                        className="focus:border-brand-600 focus:ring-brand-600/15 mt-3 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
                      />
                    )}
                  </WizardStep>
                )}

                {currentStep.id === "topic" && (
                  <WizardStep
                    title="¿De qué se trata exactamente?"
                    hint="Cuéntame en una o dos frases qué pasa, qué cambia, qué debe saber el usuario."
                  >
                    <textarea
                      autoFocus
                      value={brief.topic ?? ""}
                      onChange={(e) => setBrief({ ...brief, topic: e.target.value })}
                      rows={5}
                      placeholder="Ej. Su tarjeta VIVA ya fue generada y le llegará en 5-10 días hábiles. Puede rastrearla por la app. Si necesita actualizar la dirección, hay un botón directo."
                      className="focus:border-brand-600 focus:ring-brand-600/15 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
                    />
                    <div className="mt-1.5 flex items-center justify-between gap-3">
                      <p className="text-[11px] text-neutral-500">
                        Mínimo 10 caracteres.{" "}
                        <span className="text-neutral-400">
                          ({(brief.topic ?? "").trim().length})
                        </span>
                      </p>
                      {/* Atajo de IA: aclara/ordena lo que escribió el usuario sin
                          inventar datos. Útil cuando el texto quedó ambiguo. */}
                      <button
                        type="button"
                        onClick={onImproveTopic}
                        disabled={busy.improveTopic || (brief.topic ?? "").trim().length < 3}
                        className="text-brand-700 hover:bg-brand-50 border-brand-200 inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-white px-2.5 py-1.5 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                        title="Claude reescribe tu texto más claro, sin inventar montos ni fechas"
                      >
                        {busy.improveTopic ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                        {busy.improveTopic ? "Mejorando…" : "Mejorar con IA"}
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-neutral-400">
                      La IA solo aclara tu redacción. No inventa datos que no hayas escrito.
                    </p>

                    {/* Extracción desde archivo: si la solicitud llegó como
                        screenshot, PDF o texto, se sube aquí y Claude llena
                        el contexto (y los chips de datos duros) por ti. */}
                    <div
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const f = e.dataTransfer.files?.[0];
                        if (f && !busy.extract) void onExtractBriefFile(f);
                      }}
                      className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-3.5"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-neutral-700">
                            ¿Te llegó la solicitud en un archivo?
                          </p>
                          <p className="mt-0.5 text-[11px] text-neutral-500">
                            Sube o arrastra una foto, PDF, PowerPoint o texto y la IA extrae la
                            información por ti. No inventa datos: solo usa lo que viene en el
                            archivo.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => extractInputRef.current?.click()}
                          disabled={busy.extract}
                          className="text-brand-700 hover:bg-brand-50 border-brand-200 inline-flex shrink-0 items-center gap-1.5 rounded-md border bg-white px-3 py-2 text-[11px] font-medium transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {busy.extract ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <FileUp className="h-3.5 w-3.5" />
                          )}
                          {busy.extract ? "Extrayendo…" : "Subir archivo"}
                        </button>
                        <input
                          ref={extractInputRef}
                          type="file"
                          accept={EXTRACT_ACCEPT}
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void onExtractBriefFile(f);
                          }}
                        />
                      </div>
                      {lastExtract && (
                        <div className="mt-2.5 rounded-md border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                          <p className="text-[11px] font-medium text-emerald-800">
                            ✓ Extraído de “{lastExtract.filename}”
                          </p>
                          <p className="mt-0.5 text-[11px] text-emerald-700">
                            {lastExtract.summary}
                            {lastExtract.filledTags.length > 0 && (
                              <>
                                {" "}
                                · Datos pre-llenados: {lastExtract.filledTags.join(", ")} (los ves
                                en el paso de información clave).
                              </>
                            )}
                          </p>
                          <p className="mt-0.5 text-[10px] text-emerald-600">
                            Revisa el texto de arriba — tú tienes la última palabra.
                          </p>
                        </div>
                      )}
                    </div>
                  </WizardStep>
                )}

                {currentStep.id === "keyInfo" && (
                  <WizardStep
                    title="¿Hay datos que SÍ o SÍ deben aparecer?"
                    hint="Opcional. Activa los chips que apliquen y llena el dato. Evita que Claude se invente cosas."
                  >
                    <KeyInfoChips
                      tags={brief.keyInfoTags ?? {}}
                      onChange={(tags) => setBrief({ ...brief, keyInfoTags: tags })}
                    />
                    {/* Si el draft viene con `keyInfo` libre (drafts viejos),
                      mostramos un textarea editable para no perder ese dato. */}
                    {brief.keyInfo && brief.keyInfo.trim() !== "" && (
                      <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/60 p-3">
                        <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-amber-700 uppercase">
                          Información clave (formato libre, draft anterior)
                        </div>
                        <textarea
                          value={brief.keyInfo ?? ""}
                          onChange={(e) => setBrief({ ...brief, keyInfo: e.target.value })}
                          rows={3}
                          className="w-full rounded border border-amber-200 bg-white px-2.5 py-2 text-xs placeholder:text-neutral-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-300/30 focus:outline-none"
                        />
                        <p className="mt-1 text-[10px] text-amber-700">
                          Esta info se manda al AI tal cual, junto con los chips de arriba.
                        </p>
                      </div>
                    )}
                    <p className="mt-3 text-[11px] text-neutral-500">
                      Puedes saltar este paso si no aplica.
                    </p>
                  </WizardStep>
                )}

                {currentStep.id === "audience" && (
                  <WizardStep
                    title="¿Quién va a recibir esto?"
                    hint="El segmento cambia el tono y los supuestos del mensaje."
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {AUDIENCES.map((a) => {
                        const active = brief.audience === a.id && !otherMode.audience;
                        return (
                          <button
                            key={a.id}
                            type="button"
                            onClick={() => {
                              setOtherMode((m) => ({ ...m, audience: false }));
                              // "VIP / Premier" autosugiere el overlay Premier y
                              // NO auto-avanza: deja visible el toggle + pilar
                              // para que el usuario lo configure.
                              if (a.id === "vip") {
                                setBrief((b) => ({ ...b, audience: a.id, isPremier: true }));
                              } else {
                                selectAndAdvance({ audience: a.id });
                              }
                            }}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-brand-600 bg-brand-50 ring-brand-600/15 ring-2"
                                : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            <span
                              className={`text-sm font-semibold ${active ? "text-brand-700" : "text-neutral-900"}`}
                            >
                              {a.label}
                            </span>
                            <span className="text-[11px] leading-tight text-neutral-500">
                              {a.help}
                            </span>
                          </button>
                        );
                      })}
                      {/* "Otro" — toggles inline text input for a custom audience. */}
                      <button
                        type="button"
                        onClick={() => {
                          setOtherMode((m) => ({ ...m, audience: true }));
                          if (brief.audience && AUDIENCES.some((a) => a.id === brief.audience)) {
                            setBrief({ ...brief, audience: "" });
                          }
                        }}
                        className={`flex flex-col items-start gap-1 rounded-xl border border-dashed p-3 text-left transition ${
                          otherMode.audience
                            ? "border-brand-600 bg-brand-50 ring-brand-600/15 ring-2"
                            : "border-neutral-300 bg-white hover:border-neutral-400 hover:bg-neutral-50"
                        }`}
                      >
                        <span
                          className={`text-sm font-semibold ${otherMode.audience ? "text-brand-700" : "text-neutral-900"}`}
                        >
                          Otro
                        </span>
                        <span className="text-[11px] leading-tight text-neutral-500">
                          Describe la audiencia a tu manera.
                        </span>
                      </button>
                    </div>
                    {otherMode.audience && (
                      <input
                        autoFocus
                        type="text"
                        value={brief.audience ?? ""}
                        onChange={(e) => setBrief({ ...brief, audience: e.target.value })}
                        placeholder="Ej. Clientes en CDMX con plan de pago a meses sin intereses."
                        className="focus:border-brand-600 focus:ring-brand-600/15 mt-3 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
                      />
                    )}

                    {/* Overlay de marca HSBC Premier (segmento World Elite). Solo
                        este segmento tiene lineamientos especiales; el resto usa
                        la marca base. Se autosugiere al elegir "VIP / Premier". */}
                    <div className="mt-5 rounded-xl border border-neutral-200 bg-neutral-50/60 p-4">
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={Boolean(brief.isPremier)}
                          onChange={(e) => {
                            const on = e.target.checked;
                            setBrief({
                              ...brief,
                              isPremier: on,
                              premierPillar: on ? brief.premierPillar : undefined,
                            });
                          }}
                          className="accent-brand-600 mt-0.5 h-4 w-4"
                        />
                        <span>
                          <span className="block text-sm font-semibold text-neutral-900">
                            Aplicar overlay HSBC World Elite
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-tight text-neutral-500">
                            Activa el tono, vocabulario y reglas de marca del segmento World Elite
                            en la generación y en la revisión.
                          </span>
                        </span>
                      </label>

                      {brief.isPremier && (
                        <div className="mt-3 pl-7">
                          <span className="text-[11px] font-medium text-neutral-600">
                            Pilar dominante (opcional)
                          </span>
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {PILLAR_ORDER.map((id: PillarId) => {
                              const active = brief.premierPillar === id;
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() =>
                                    setBrief({
                                      ...brief,
                                      premierPillar: active ? undefined : id,
                                    })
                                  }
                                  className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                                    active
                                      ? "border-brand-600 bg-brand-50 text-brand-700"
                                      : "border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50"
                                  }`}
                                >
                                  {PILLARS[id].label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  </WizardStep>
                )}

                {currentStep.id === "urgency" && (
                  <WizardStep
                    title="¿Qué tan urgente es?"
                    hint="Determina la intensidad del lenguaje y el CTA."
                  >
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                      {URGENCIES.map((u) => {
                        const active = brief.urgency === u.id;
                        return (
                          <button
                            key={u.id}
                            type="button"
                            onClick={() => selectAndAdvance({ urgency: u.id })}
                            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${
                              active
                                ? "border-brand-600 bg-brand-50 ring-brand-600/15 ring-2"
                                : "border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50"
                            }`}
                          >
                            <span
                              className={`text-sm font-semibold ${active ? "text-brand-700" : "text-neutral-900"}`}
                            >
                              {u.label}
                            </span>
                            <span className="text-[11px] leading-tight text-neutral-500">
                              {u.help}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </WizardStep>
                )}

                {currentStep.id === "image" && (
                  <WizardStep
                    title="¿Qué imagen va en el hero?"
                    hint="Opcional. Tres formas: busca en Unsplash, sube la tuya, o copia un prompt para generarla en tu IA preferida."
                  >
                    <WizardImagePicker
                      brief={brief}
                      heroImage={heroImage}
                      onPick={(img) => setHeroImage(img)}
                      onClear={() => setHeroImage(null)}
                      onError={setError}
                    />
                  </WizardStep>
                )}
              </div>

              {/* Navigation footer — EN FLUJO, justo debajo del contenido del
                  paso. Antes estaba pineado con position:absolute al fondo del
                  viewport, lo que dejaba un hueco enorme entre las tarjetas y
                  el botón (había que hacer scroll para darle "Siguiente"). En
                  flujo el botón queda siempre pegado al contenido. */}
              <div className="mt-8 border-t border-neutral-200 pt-4">
                <div className="flex w-full items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                      disabled={stepIdx === 0}
                      className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                      Atrás
                    </button>
                    <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                      {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                      Paso {stepIdx + 1} de {WIZARD_STEPS.length}
                    </div>
                  </div>

                  {isLastStep ? (
                    <button
                      type="button"
                      onClick={onGenerate}
                      disabled={busy.generate || !isBriefComplete(brief)}
                      className="bg-brand-600 hover:bg-brand-700 inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy.generate ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Generando con IA…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generar notificación
                        </>
                      )}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2">
                      {!currentStep.required && !canAdvance && (
                        <button
                          type="button"
                          onClick={() =>
                            setStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))
                          }
                          className="text-xs font-medium text-neutral-500 hover:text-neutral-700"
                        >
                          Saltar
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}
                        disabled={!canAdvance}
                        className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-medium text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Siguiente
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {error && (
                  <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    {error}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar + copy/preview only render once the wizard is closed. When
          the wizard is open it owns the full screen, so the user is in a
          single-focus mode (Claude-design wizard vibe). */}
      {!briefOpen && (
        <>
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-5 py-2">
            <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
              {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              {isPending ? "Guardando…" : "Guardado automáticamente"}
            </div>
            <div className="flex items-center gap-2">
              {/* Downloads — only enable after copy exists. */}
              <button
                type="button"
                onClick={() => onDownload("image")}
                disabled={!copy.subject || busy.download !== undefined}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Descargar la pieza como imagen PNG (tamaño nativo, 2× retina)"
              >
                {busy.download === "image" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <ImageIcon className="h-3 w-3" />
                )}
                PNG · Pieza
              </button>
              <button
                type="button"
                onClick={() => onDownload("presentation")}
                disabled={!copy.subject || busy.download !== undefined}
                className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                title="Descargar deck completo para revisión de HSBC"
              >
                {busy.download === "presentation" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <Presentation className="h-3 w-3" />
                )}
                PDF · Para HSBC
              </button>
              {/* Divider */}
              <div className="h-4 w-px bg-neutral-200" />
              <button
                type="button"
                onClick={onReview}
                disabled={!copy.subject}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Revisar la copy contra las reglas de marca antes de enviar"
              >
                <ShieldCheck className="h-3 w-3" />
                Revisar
              </button>
              <button
                type="button"
                onClick={() => setBriefOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                title="Volver a abrir el brief para re-generar"
              >
                <Pencil className="h-3 w-3" />
                Editar brief
              </button>
            </div>
          </div>

          {/* MAIN: copy + preview (2 columns, both get full breathing room). */}
          <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
            {/* COPY — left column when 2-col, half width */}
            <section className="overflow-y-auto border-r border-neutral-200 bg-white">
              <div className="p-6">
                <h2 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  Copy editable
                </h2>
                <div className="mt-4 space-y-4">
                  <CopyField
                    field="subject"
                    label="Asunto"
                    value={copy.subject ?? ""}
                    onChange={(v) => setCopy({ ...copy, subject: v })}
                    onRefine={(instr) => onRefine("subject", instr)}
                    refining={busy.refine === "subject"}
                  />
                  <CopyField
                    field="preheader"
                    label="Preheader"
                    value={copy.preheader ?? ""}
                    onChange={(v) => setCopy({ ...copy, preheader: v })}
                    onRefine={(instr) => onRefine("preheader", instr)}
                    refining={busy.refine === "preheader"}
                  />
                  <CopyField
                    field="headline"
                    label="Titular"
                    value={copy.headline ?? ""}
                    onChange={(v) => setCopy({ ...copy, headline: v })}
                    onRefine={(instr) => onRefine("headline", instr)}
                    refining={busy.refine === "headline"}
                  />
                  <CopyField
                    field="body"
                    label="Cuerpo"
                    value={copy.body ?? ""}
                    onChange={(v) => setCopy({ ...copy, body: v })}
                    onRefine={(instr) => onRefine("body", instr)}
                    refining={busy.refine === "body"}
                    textarea
                  />
                  <CopyField
                    field="cta_label"
                    label="CTA"
                    value={copy.cta_label ?? ""}
                    onChange={(v) => setCopy({ ...copy, cta_label: v })}
                    onRefine={(instr) => onRefine("cta_label", instr)}
                    refining={busy.refine === "cta_label"}
                  />
                  <CopyField
                    field="sms"
                    label="SMS"
                    value={copy.sms ?? ""}
                    onChange={(v) => setCopy({ ...copy, sms: v })}
                    onRefine={(instr) => onRefine("sms", instr)}
                    refining={busy.refine === "sms"}
                    textarea
                    hint={`${(copy.sms ?? "").length}/160`}
                  />
                </div>

                {/* Image picker */}
                <div className="mt-8 rounded-lg border border-neutral-200 bg-neutral-50/60 p-4">
                  <div className="flex items-center gap-2 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                    <ImageIcon className="h-3.5 w-3.5" />
                    Imagen del hero
                  </div>
                  {heroImage?.url && (
                    <div className="mt-3 flex items-start gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={heroImage.url}
                        alt={heroImage.alt ?? ""}
                        className="h-20 w-32 rounded border border-neutral-200 object-cover"
                      />
                      <div className="flex-1">
                        <div className="text-xs font-medium text-neutral-700">
                          {heroImage.alt || "Sin descripción"}
                        </div>
                        <div className="mt-0.5 text-[11px] text-neutral-500">
                          Fuente: {heroImage.source}
                        </div>
                        <button
                          type="button"
                          onClick={() => setHeroImage(null)}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline"
                        >
                          <X className="h-3 w-3" />
                          Quitar
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mt-3 flex gap-2">
                    <input
                      type="text"
                      value={imageQuery}
                      onChange={(e) => setImageQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          onImageSearch();
                        }
                      }}
                      placeholder="Buscar en Freepik (ej. tarjeta credito viva mexico)"
                      className="focus:border-brand-600 focus:ring-brand-600/15 h-9 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={onImageSearch}
                      disabled={busy.search || !imageQuery.trim()}
                      className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {busy.search ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Wand2 className="h-3.5 w-3.5" />
                      )}
                      Buscar
                    </button>
                  </div>

                  {/* Upload propio — atajo cuando Freepik no devuelve lo que buscamos
                      o cuando ya tienes la imagen lista (Adobe, captura, etc.). */}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-px flex-1 bg-neutral-200" />
                    <span className="text-[10px] font-medium tracking-wider text-neutral-400 uppercase">
                      o
                    </span>
                    <div className="h-px flex-1 bg-neutral-200" />
                  </div>
                  <input
                    ref={uploadInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onUploadFile(f);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => uploadInputRef.current?.click()}
                    disabled={busy.upload}
                    className="mt-2 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Sube tu propio PNG, JPG o WebP (máx. 3 MB)"
                  >
                    {busy.upload ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Upload className="h-3.5 w-3.5" />
                    )}
                    Subir mi imagen
                    <span className="text-neutral-400">· PNG, JPG, WebP · 3 MB</span>
                  </button>
                  {imageResults.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {imageResults.map((img) => (
                        <button
                          key={img.id}
                          type="button"
                          onClick={() => pickImage(img)}
                          className="hover:ring-brand-600 group relative overflow-hidden rounded border border-neutral-200 transition hover:ring-2"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={img.thumbUrl}
                            alt={img.title}
                            className="h-20 w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* PREVIEW — right column when 2-col */}
            <section
              className={`overflow-y-auto transition-colors ${
                previewDark ? "bg-neutral-900" : "bg-neutral-100"
              }`}
            >
              <div
                className={`sticky top-0 z-10 flex items-center justify-between border-b px-5 py-2.5 backdrop-blur ${
                  previewDark
                    ? "border-neutral-700 bg-neutral-900/95"
                    : "border-neutral-200 bg-neutral-100/95"
                }`}
              >
                <div
                  className={`text-[11px] font-semibold tracking-wider uppercase ${
                    previewDark ? "text-neutral-400" : "text-neutral-500"
                  }`}
                >
                  Preview HSBC
                </div>
                <button
                  type="button"
                  onClick={() => setPreviewDark((v) => !v)}
                  title={previewDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
                  className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
                    previewDark
                      ? "border-neutral-600 bg-neutral-800 text-neutral-200 hover:bg-neutral-700"
                      : "border-neutral-300 bg-white text-neutral-700 hover:bg-neutral-50"
                  }`}
                >
                  {previewDark ? "☀️ Claro" : "🌙 Oscuro"}
                </button>
              </div>
              <div className="p-5">
                <div
                  className={`mx-auto max-w-[640px] overflow-hidden rounded-lg border shadow-sm ${
                    previewDark
                      ? "border-neutral-700 bg-neutral-800"
                      : "border-neutral-200 bg-white"
                  }`}
                >
                  <iframe
                    title="Email preview"
                    // Si activamos modo oscuro, le injectamos un wrapper con
                    // filter: invert+hue-rotate al body del email. No es el
                    // dark mode "oficial" del cliente, pero da una idea de
                    // cómo se vería si el cliente respeta los colores
                    // y aplicaría su tema oscuro encima.
                    srcDoc={
                      previewDark
                        ? wrapForDark(fixPreviewScale(previewHtml))
                        : fixPreviewScale(previewHtml)
                    }
                    className="block h-[calc(100vh-12rem)] w-full border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </section>
          </div>
        </>
      )}

      {/* Panel de pre-flight (se abre con "Revisar"). */}
      {preflight && (
        <PreflightPanel
          result={preflight}
          isPremier={Boolean(brief.isPremier)}
          onClose={() => setPreflight(null)}
        />
      )}
    </div>
  );
}

/* ─────────────────── tiny field components ─────────────────── */

/**
 * Generic wrapper for a single wizard step. Provides the big-question +
 * helper-text header and slot for the answer input. Keeps every step
 * visually consistent.
 */
function WizardStep({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold tracking-tight text-neutral-900">{title}</h2>
      <p className="mt-1.5 text-sm text-neutral-600">{hint}</p>
      <div className="mt-5">{children}</div>
    </div>
  );
}

function CopyField({
  field,
  label,
  value,
  onChange,
  onRefine,
  refining,
  textarea = false,
  hint,
}: {
  field: CopyField;
  label: string;
  value: string;
  onChange: (v: string) => void;
  onRefine: (instruction: string) => void;
  refining: boolean;
  textarea?: boolean;
  hint?: string;
}) {
  const [showRefine, setShowRefine] = useState(false);
  const [instruction, setInstruction] = useState("");

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          {label}
        </label>
        <div className="flex items-center gap-2">
          {hint && <span className="text-[10px] text-neutral-400">{hint}</span>}
          <button
            type="button"
            onClick={() => setShowRefine((v) => !v)}
            className="hover:text-brand-700 inline-flex items-center gap-1 text-[11px] font-medium text-neutral-600 transition"
          >
            <Sparkles className="h-3 w-3" />
            Refinar
          </button>
        </div>
      </div>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={field === "body" ? 5 : 2}
          className="focus:border-brand-600 mt-2 w-full rounded-md border border-neutral-200 bg-neutral-50 px-2.5 py-2 text-sm text-neutral-900 focus:outline-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="focus:border-brand-600 mt-2 h-9 w-full rounded-md border border-neutral-200 bg-neutral-50 px-2.5 text-sm text-neutral-900 focus:outline-none"
        />
      )}
      {showRefine && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="Cómo quieres cambiarlo (ej. más corto)"
            className="focus:border-brand-600 h-8 flex-1 rounded-md border border-neutral-200 bg-white px-2 text-xs focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              if (!instruction.trim()) return;
              onRefine(instruction);
              setShowRefine(false);
              setInstruction("");
            }}
            disabled={refining || !instruction.trim()}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {refining ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Sparkles className="h-3 w-3" />
            )}
            Aplicar
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Envuelve el HTML del email en una capa CSS que simula cómo se vería en
 * el "dark mode" forzado de algunos clientes de correo (Gmail iOS, Outlook
 * Windows con tema oscuro, Apple Mail Modo Oscuro). No es perfecto — el
 * dark mode real es decidido por el cliente del usuario y a veces respeta
 * `@media (prefers-color-scheme: dark)` y a veces no — pero ayuda a ver
 * dónde el copy o las imágenes pierden contraste.
 */
function wrapForDark(html: string): string {
  // Inyectamos un style global que invierte los colores claros y mantiene
  // las imágenes intactas (filter: invert(1) hue-rotate(180deg) preserva
  // los hues mientras voltea la luminosidad).
  const darkCss = `
    <style>
      html, body { background: #0a0a0a !important; }
      body { filter: invert(0.92) hue-rotate(180deg); }
      img, svg { filter: invert(1) hue-rotate(180deg); }
      a { color: #91b6f6 !important; }
    </style>
  `;
  return injectStyle(html, darkCss);
}

/**
 * El template HSBC tiene una pelea en el <html> entre dos declaraciones
 * de font-size:
 *   font-size:calc(1.0 * 62.5%)   ← intencional, da 1rem = 10px
 *   font-size:16px                ← override que rompe la matemática rem
 *
 * Con el override de 16px, body (1.6rem) = 25.6px y h1 (4rem) = 64px, lo
 * que hace que el preview se vea GIGANTE. En un cliente de email real este
 * problema no se nota porque algunos clientes ignoran el override.
 *
 * NO tocamos el HTML del email (es vendor template). En su lugar, en el
 * preview del editor inyectamos un override `!important` que fuerza 10px
 * en html, restaurando la matemática que el template asume.
 */
function fixPreviewScale(html: string): string {
  // Univers Next for HSBC embebida como data URLs WOFF2 (Regular 400,
  // Medium 500, Bold 700). El @font-face del template apunta a
  // rastreo.kublau.com con URL firmada temporal que no carga fiable dentro
  // del iframe srcDoc (origen opaco) — los data URLs siempre cargan.
  //
  // Ahora SÍ tenemos el peso Bold real: los <strong> renderean con la
  // Univers Bold nativa (no faux-bold). Archivos oficiales de HSBC.
  const fixCss = `
    <style>
      @font-face {
        font-family: 'Univers Next';
        src: url('${UNIVERS_NEXT_REGULAR_WOFF2}') format('woff2');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Univers Next';
        src: url('${UNIVERS_NEXT_MEDIUM_WOFF2}') format('woff2');
        font-weight: 500;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Univers Next';
        src: url('${UNIVERS_NEXT_BOLD_WOFF2}') format('woff2');
        font-weight: 700;
        font-style: normal;
        font-display: swap;
      }
    </style>
  `;
  return injectStyle(html, fixCss);
}

/** Inserta un <style> antes de </head>, o al inicio si no hay head. */
function injectStyle(html: string, styleTag: string): string {
  if (html.includes("</head>")) {
    return html.replace("</head>", `${styleTag}</head>`);
  }
  return `${styleTag}${html}`;
}

/* ─────────────────── Chips de "información clave" ─────────────────── */

/**
 * Las definiciones de cada chip. El renderer mapea sobre estas y muestra
 * los inputs correspondientes al activarse. Si agregas un nuevo chip,
 * acuérdate de extender `DraftKeyInfo` en `lib/db/schema.ts` y
 * `serializeKeyInfoTags` en `lib/notifications/key-info.ts`.
 */
const KEY_INFO_CHIPS = [
  { id: "cardEnding", label: "Terminación de tarjeta", icon: "🎯" },
  { id: "amount", label: "Monto / premio", icon: "💰" },
  { id: "deadline", label: "Fecha límite", icon: "📅" },
  { id: "dateRange", label: "Rango de fechas", icon: "📆" },
  { id: "promoUrl", label: "URL / código promo", icon: "🔗" },
] as const;

type ChipId = (typeof KEY_INFO_CHIPS)[number]["id"];

function KeyInfoChips({
  tags,
  onChange,
}: {
  tags: DraftKeyInfo;
  onChange: (tags: DraftKeyInfo) => void;
}) {
  /** Un chip está "activo" cuando su campo tiene valor (o el usuario lo activó vacío). */
  const [explicit, setExplicit] = useState<Set<ChipId>>(() => {
    const s = new Set<ChipId>();
    if (tags.cardEnding) s.add("cardEnding");
    if (tags.amount) s.add("amount");
    if (tags.deadline) s.add("deadline");
    if (tags.dateRange?.from || tags.dateRange?.to) s.add("dateRange");
    if (tags.promoUrl) s.add("promoUrl");
    return s;
  });

  function toggle(id: ChipId) {
    const next = new Set(explicit);
    if (next.has(id)) {
      next.delete(id);
      // Al desactivar el chip, también limpiamos el valor para que no se
      // mande al AI por error.
      const cleared: DraftKeyInfo = { ...tags };
      if (id === "cardEnding") delete cleared.cardEnding;
      if (id === "amount") delete cleared.amount;
      if (id === "deadline") delete cleared.deadline;
      if (id === "dateRange") delete cleared.dateRange;
      if (id === "promoUrl") delete cleared.promoUrl;
      onChange(cleared);
    } else {
      next.add(id);
    }
    setExplicit(next);
  }

  return (
    <div className="space-y-3">
      {/* Fila de chips */}
      <div className="flex flex-wrap gap-2">
        {KEY_INFO_CHIPS.map((c) => {
          const active = explicit.has(c.id);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "border-brand-600 bg-brand-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400 hover:bg-neutral-50"
              }`}
            >
              <span aria-hidden>{c.icon}</span>
              <span>{c.label}</span>
            </button>
          );
        })}
      </div>

      {/* Inputs por chip activo. El orden refleja el de la lista de chips. */}
      {explicit.size > 0 && (
        <div className="space-y-2.5 rounded-lg border border-neutral-200 bg-neutral-50/60 p-3.5">
          {explicit.has("cardEnding") && (
            <FieldRow label="Terminación de tarjeta (4 dígitos)">
              <input
                inputMode="numeric"
                maxLength={4}
                value={tags.cardEnding ?? ""}
                onChange={(e) =>
                  onChange({
                    ...tags,
                    cardEnding: e.target.value.replace(/[^0-9]/g, ""),
                  })
                }
                placeholder="4823"
                className="focus:border-brand-600 focus:ring-brand-600/15 w-32 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm tracking-widest tabular-nums placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
              />
            </FieldRow>
          )}
          {explicit.has("amount") && (
            <FieldRow label="Monto / premio">
              <input
                type="text"
                value={tags.amount ?? ""}
                onChange={(e) => onChange({ ...tags, amount: e.target.value })}
                placeholder="$5,000 MXN · 2,500 puntos · 15% de cashback"
                className="focus:border-brand-600 focus:ring-brand-600/15 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
              />
            </FieldRow>
          )}
          {explicit.has("deadline") && (
            <FieldRow label="Fecha límite">
              <input
                type="date"
                value={tags.deadline ?? ""}
                onChange={(e) => onChange({ ...tags, deadline: e.target.value })}
                className="focus:border-brand-600 focus:ring-brand-600/15 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none"
              />
            </FieldRow>
          )}
          {explicit.has("dateRange") && (
            <FieldRow label="Rango de fechas">
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={tags.dateRange?.from ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...tags,
                      dateRange: { ...tags.dateRange, from: e.target.value },
                    })
                  }
                  className="focus:border-brand-600 focus:ring-brand-600/15 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none"
                />
                <span className="text-xs text-neutral-500">a</span>
                <input
                  type="date"
                  value={tags.dateRange?.to ?? ""}
                  onChange={(e) =>
                    onChange({
                      ...tags,
                      dateRange: { ...tags.dateRange, to: e.target.value },
                    })
                  }
                  className="focus:border-brand-600 focus:ring-brand-600/15 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm focus:ring-2 focus:outline-none"
                />
              </div>
            </FieldRow>
          )}
          {explicit.has("promoUrl") && (
            <FieldRow label="URL o código promo">
              <input
                type="text"
                value={tags.promoUrl ?? ""}
                onChange={(e) => onChange({ ...tags, promoUrl: e.target.value })}
                placeholder="hsbc.com/promo · CÓDIGO2026"
                className="focus:border-brand-600 focus:ring-brand-600/15 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
              />
            </FieldRow>
          )}
        </div>
      )}

      {explicit.size === 0 && (
        <p className="text-[11px] text-neutral-500">
          Si no aplica nada, sigue al siguiente paso. El AI escribirá la notificación sin amarrarse
          a datos específicos.
        </p>
      )}
    </div>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-medium text-neutral-600">{label}</span>
      {children}
    </div>
  );
}

/* ─────────────────── Image picker dentro del wizard ─────────────────── */

/**
 * Selector de imagen del wizard con 3 modos: Buscar (Unsplash), Subir,
 * o Copiar prompt para generar en un servicio externo de imágenes (Midjourney,
 * DALL·E, etc.). El prompt se construye desde el brief del wizard
 * (`lib/notifications/image-prompt.ts`).
 */
function WizardImagePicker({
  brief,
  heroImage,
  onPick,
  onClear,
  onError,
}: {
  brief: DraftBrief;
  heroImage: DraftHeroImage | null;
  onPick: (img: DraftHeroImage) => void;
  onClear: () => void;
  onError: (e: string | null) => void;
}) {
  // Default: "Generar con IA" primero (es lo que más valor da). Luego buscar,
  // luego subir. El orden de los tabs refleja esa prioridad.
  const [tab, setTab] = useState<"prompt" | "search" | "upload">("prompt");

  return (
    <div className="space-y-4">
      {/* Imagen actual (si ya seleccionaste una) */}
      {heroImage?.url && (
        <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={heroImage.url}
            alt={heroImage.alt ?? ""}
            className="h-24 w-40 rounded border border-neutral-200 object-cover"
          />
          <div className="flex-1 text-sm">
            <div className="font-medium text-neutral-800">
              {heroImage.alt || "Imagen seleccionada"}
            </div>
            <div className="text-[11px] text-neutral-500">Fuente: {heroImage.source}</div>
            <button
              type="button"
              onClick={onClear}
              className="mt-1.5 inline-flex items-center gap-1 text-[11px] text-rose-600 hover:underline"
            >
              <X className="h-3 w-3" />
              Quitar
            </button>
          </div>
        </div>
      )}

      {/* Tabs de las 3 opciones — orden: Generar con IA, Buscar, Subir */}
      <div className="flex gap-1.5 rounded-lg border border-neutral-200 bg-neutral-50 p-1">
        <TabButton active={tab === "prompt"} onClick={() => setTab("prompt")}>
          <Sparkles className="h-3.5 w-3.5" />
          Generar con IA
        </TabButton>
        <TabButton active={tab === "search"} onClick={() => setTab("search")}>
          <Wand2 className="h-3.5 w-3.5" />
          Buscar (Unsplash)
        </TabButton>
        <TabButton active={tab === "upload"} onClick={() => setTab("upload")}>
          <Upload className="h-3.5 w-3.5" />
          Subir mía
        </TabButton>
      </div>

      {tab === "upload" && (
        <UploadPanel onPick={onPick} onError={onError} disabled={Boolean(heroImage?.url)} />
      )}
      {tab === "search" && <UnsplashPanel onPick={onPick} onError={onError} />}
      {tab === "prompt" && <ImagePromptPanel brief={brief} onPick={onPick} onError={onError} />}

      <p className="text-[11px] text-neutral-500">
        Puedes saltar este paso y agregar la imagen después desde el editor.
      </p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition ${
        active ? "bg-white text-neutral-900 shadow-sm" : "text-neutral-600 hover:text-neutral-900"
      }`}
    >
      {children}
    </button>
  );
}

/* ─── Tab: Subir imagen propia ─── */

function UploadPanel({
  onPick,
  onError,
  disabled,
}: {
  onPick: (img: DraftHeroImage) => void;
  onError: (e: string | null) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    if (!ALLOWED_HERO_MIME.includes(file.type as (typeof ALLOWED_HERO_MIME)[number])) {
      onError("Solo se aceptan imágenes PNG, JPG o WebP.");
      return;
    }
    if (file.size > MAX_HERO_UPLOAD_BYTES) {
      onError(`La imagen pesa ${(file.size / (1024 * 1024)).toFixed(1)} MB. Máx 3 MB.`);
      return;
    }
    setUploading(true);
    onError(null);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("No pude leer el archivo."));
        r.readAsDataURL(file);
      });
      onPick({
        url: dataUrl,
        alt: file.name.replace(/\.[^.]+$/, ""),
        source: "upload",
      });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falló la carga.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading || disabled}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-neutral-300 bg-white px-4 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {disabled ? "Quita la imagen actual para subir otra" : "Subir mi imagen"}
        {!disabled && <span className="text-xs text-neutral-400">PNG, JPG, WebP · 3 MB</span>}
      </button>
    </div>
  );
}

/* ─── Tab: Buscar Unsplash ─── */

function UnsplashPanel({
  onPick,
  onError,
}: {
  onPick: (img: DraftHeroImage) => void;
  onError: (e: string | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnsplashImage[]>([]);
  const [busy, setBusy] = useState(false);

  async function onSearch() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    onError(null);
    try {
      const r = await searchUnsplashAction(q);
      setResults(r);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Falló la búsqueda.");
    } finally {
      setBusy(false);
    }
  }

  function pick(img: UnsplashImage) {
    onPick({
      url: img.url,
      alt: img.alt || img.description || query,
      source: "url",
      query,
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void onSearch();
            }
          }}
          placeholder="Ej. mujer mexicana sonriendo con tarjeta"
          className="focus:border-brand-600 focus:ring-brand-600/15 h-9 flex-1 rounded-md border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
        />
        <button
          type="button"
          onClick={onSearch}
          disabled={busy || !query.trim()}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Wand2 className="h-3.5 w-3.5" />
          )}
          Buscar
        </button>
      </div>

      {results.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {results.map((img) => (
            <button
              key={img.id}
              type="button"
              onClick={() => pick(img)}
              className="hover:ring-brand-600 group relative overflow-hidden rounded border border-neutral-200 transition hover:ring-2"
              title={img.attribution}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.thumbUrl} alt={img.alt || ""} className="h-20 w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {results.length === 0 && !busy && (
        <p className="text-[11px] text-neutral-500">
          Las imágenes vienen de Unsplash. Si no encuentras nada, prueba en inglés (suele dar
          mejores resultados).
        </p>
      )}
    </div>
  );
}

/* ─── Tab: Generar con IA (copy prompt) ─── */

/**
 * Atajos a generadores de imagen populares. El usuario hace click, le
 * copiamos el prompt al clipboard, y le abrimos el tool en nueva pestaña
 * para que solo pegue (Cmd+V). Cada tool tiene su propio link de "imagine".
 *
 * Cuando alguno de los tools tenga API pública de URL params, podemos
 * pasar el prompt en la URL directamente. Hoy ninguno lo soporta de forma
 * fiable, así que el patrón clipboard+open es lo más robusto.
 */
const AI_IMAGE_GENERATORS = [
  { id: "chatgpt", label: "ChatGPT", url: "https://chat.openai.com" },
  { id: "midjourney", label: "Midjourney", url: "https://www.midjourney.com/imagine" },
  { id: "imagen", label: "Imagen (Gemini)", url: "https://gemini.google.com/app" },
  { id: "firefly", label: "Adobe Firefly", url: "https://firefly.adobe.com" },
] as const;

function ImagePromptPanel({
  brief,
  onPick,
  onError,
}: {
  brief: DraftBrief;
  onPick: (img: DraftHeroImage) => void;
  onError: (e: string | null) => void;
}) {
  // 3 variaciones del prompt — el usuario puede ver/copiar la que quiera.
  // Generar 3 manda UNA imagen por variación al modelo.
  const variations: PromptVariation[] = useMemo(() => buildImagePromptVariations(brief), [brief]);
  const [activeVar, setActiveVar] = useState<PromptVariation["id"]>("editorial");
  const activeVariation = variations.find((v) => v.id === activeVar) ?? variations[0]!;
  const prompt = activeVariation.prompt;
  const [copied, setCopied] = useState(false);
  const [pasting, setPasting] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState<GeneratedImage[]>([]);

  async function copyToClipboard(): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(prompt);
      return true;
    } catch {
      return false;
    }
  }

  async function onCopy() {
    const ok = await copyToClipboard();
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  async function onOpenGenerator(toolId: string, url: string) {
    // Pre-copia el prompt para que el usuario solo pegue al abrir el tool.
    setPasting(toolId);
    await copyToClipboard();
    // Pequeño delay para que el usuario vea "Copiando..." antes de irse.
    setTimeout(() => {
      window.open(url, "_blank", "noopener,noreferrer");
      setPasting(null);
    }, 350);
  }

  async function onGenerateWithBanana() {
    setGenerating(true);
    onError(null);
    setGenerated([]);
    try {
      // Manda las 3 variaciones — el server las construye desde el brief
      // y devuelve 1 imagen por variación.
      const results = await generateImageVariationsAction({ brief });
      if (results.length === 0) {
        onError(
          "Nano Banana no devolvió ninguna imagen. Puede ser rate limit o quota. Espera 1 min e intenta otra vez, o usa otro generador.",
        );
      }
      setGenerated(results);
    } catch (e) {
      onError(
        e instanceof Error
          ? `No pude generar con Nano Banana: ${e.message}`
          : "Falló la generación con Nano Banana.",
      );
    } finally {
      setGenerating(false);
    }
  }

  function pickGenerated(img: GeneratedImage) {
    onPick({
      url: img.url,
      alt: img.altSummary,
      source: "upload",
    });
  }

  return (
    <div className="space-y-3">
      {/* ★ Atajo principal: generar 2 variaciones distintas con Nano Banana */}
      <div className="bg-brand-50/40 border-brand-200 rounded-lg border p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <div>
            <div className="text-brand-800 text-sm font-semibold">✨ Generar con Nano Banana</div>
            <div className="text-[11px] text-neutral-600">
              2 variaciones distintas (editorial / contextual). ~10–20 seg.
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerateWithBanana}
            disabled={generating}
            className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-1.5 rounded-md px-4 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generando 3 variaciones…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generar 3
              </>
            )}
          </button>
        </div>

        {generated.length > 0 && (
          <div className="mt-3 grid grid-cols-3 gap-2">
            {generated.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => pickGenerated(img)}
                className="hover:ring-brand-600 group relative overflow-hidden rounded-lg border border-neutral-200 transition hover:ring-2"
                title={img.variationName ?? "Generada"}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={img.altSummary} className="h-32 w-full object-cover" />
                {img.variationName && (
                  <div className="absolute top-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-white uppercase">
                    {img.variationName}
                  </div>
                )}
                <div className="bg-brand-600/0 group-hover:bg-brand-600/15 absolute inset-0 flex items-center justify-center transition">
                  <span className="rounded bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-neutral-900 opacity-0 transition group-hover:opacity-100">
                    Usar esta
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="text-center text-[10px] tracking-widest text-neutral-400 uppercase">
        o copia el prompt y úsalo en otro generador
      </div>

      <div className="rounded-lg border border-neutral-200 bg-neutral-50/60 p-3">
        {/* Tabs para alternar entre las 3 variaciones del prompt */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <div className="flex gap-1 rounded bg-neutral-100 p-0.5">
            {variations.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setActiveVar(v.id);
                  setCopied(false);
                }}
                className={`rounded px-2.5 py-1 text-[11px] font-medium transition ${
                  activeVar === v.id
                    ? "bg-white text-neutral-900 shadow-sm"
                    : "text-neutral-600 hover:text-neutral-900"
                }`}
              >
                {v.name}
              </button>
            ))}
          </div>
          {/* Copy rápido al lado de las tabs */}
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-6 items-center gap-1 rounded border border-neutral-300 bg-white px-2 text-[10px] font-medium text-neutral-600 transition hover:bg-neutral-50"
          >
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>
        <div className="mb-1.5 text-[10px] text-neutral-500">{activeVariation.description}</div>
        <textarea
          readOnly
          value={prompt}
          rows={12}
          className="w-full resize-none rounded border border-neutral-200 bg-white px-3 py-2 font-mono text-[11px] leading-relaxed text-neutral-700"
        />
      </div>

      {/* Botón principal de copiar */}
      <button
        type="button"
        onClick={onCopy}
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-semibold text-white transition"
      >
        {copied ? (
          "✓ Prompt copiado al portapapeles"
        ) : (
          <>
            <Sparkles className="h-4 w-4" />
            Copiar prompt al portapapeles
          </>
        )}
      </button>

      {/* Atajos a generadores */}
      <div className="rounded-lg border border-neutral-200 bg-white p-3">
        <div className="mb-2 text-[11px] font-medium text-neutral-600">
          O abre directo un generador (te copiamos el prompt y lo abrimos en nueva pestaña — solo
          pega con Cmd+V):
        </div>
        <div className="grid grid-cols-2 gap-2">
          {AI_IMAGE_GENERATORS.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => onOpenGenerator(g.id, g.url)}
              disabled={pasting !== null}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pasting === g.id ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Copiando…
                </>
              ) : (
                <>
                  {g.label}
                  <ArrowRight className="h-3 w-3" />
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-neutral-500">
        Cuando tengas la imagen generada, vuelve aquí, ve a la pestaña <strong>Subir mía</strong> y
        súbela.
      </p>
    </div>
  );
}

/* ─────────────────── Generating overlay (frases creativas) ─────────────────── */

/**
 * Frases que cyclamos durante la llamada al AI. Estilo "cocina" porque
 * resuena con "armar receta de notificación". Si se acaban antes de que
 * Claude responda, hacemos loop al inicio.
 */
const GENERATING_PHRASES = [
  "Mezclando los ingredientes…",
  "Calentando la sartén creativa…",
  "Agregando una pizca de magia…",
  "Probando el sazón con HSBC…",
  "Aplicando el toque Kublau…",
  "Afinando el copy a fuego lento…",
  "Salteando con palabras frescas…",
  "Reduciendo a lo esencial…",
  "Emplatando con elegancia…",
  "Sirviendo en plato bonito…",
] as const;

export function GeneratingOverlay({ visible }: { visible: boolean }) {
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    // React 19 prohibe setState directo en effects (react-hooks/set-state-in-effect),
    // así que NO reseteamos a 0 cuando se cierra — la frase reanuda desde
    // donde quedó la próxima vez, lo cual es UX inocuo.
    if (!visible) return;
    const t = setInterval(() => {
      setPhraseIdx((i) => (i + 1) % GENERATING_PHRASES.length);
    }, 1800);
    return () => clearInterval(t);
  }, [visible]);

  if (!visible) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm"
      role="status"
      aria-live="polite"
    >
      <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-brand-50 inline-flex h-10 w-10 items-center justify-center rounded-full">
            <Sparkles className="text-brand-600 h-5 w-5 animate-pulse" />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold text-neutral-900">Generando tu pieza</div>
            <div className="text-xs text-neutral-500">Esto suele tardar 5 a 15 segundos</div>
          </div>
        </div>
        {/* Frase creativa que cicla */}
        <div className="mt-5 h-6 overflow-hidden">
          <div
            key={phraseIdx}
            className="text-brand-700 animate-[fadeIn_0.35s_ease-in] text-sm font-medium"
          >
            {GENERATING_PHRASES[phraseIdx]}
          </div>
        </div>
        {/* Barra de progreso animada (visual, no refleja % real) */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-neutral-100">
          <div className="bg-brand-600 h-full w-1/3 animate-[slide_2s_ease-in-out_infinite] rounded-full" />
        </div>
      </div>
      <style jsx global>{`
        @keyframes slide {
          0%,
          100% {
            transform: translateX(-100%);
          }
          50% {
            transform: translateX(280%);
          }
        }
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
