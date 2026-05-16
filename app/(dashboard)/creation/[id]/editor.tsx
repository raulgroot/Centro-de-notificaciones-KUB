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
  generateCopyAction,
  refineFieldAction,
  saveDraftAction,
  searchImagesAction,
} from "../actions";
import type { NotificationDraft } from "@/lib/adapters/supabase/notification-drafts";
import type { DraftBrief, DraftCopy, DraftHeroImage } from "@/lib/db/schema";
import { renderEmailHtml } from "@/lib/notifications/template";
import type { FreepikImage } from "@/lib/adapters/freepik/client";
import {
  ArrowLeft,
  ArrowRight,
  FileText,
  ImageIcon,
  Loader2,
  Pencil,
  Presentation,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";

/** Products that have an official HSBC card icon under /public/cards/. */
const PRODUCTS = [
  { id: "viva", label: "Viva", icon: "/cards/viva.png" },
  { id: "vivaplus", label: "Viva Plus", icon: "/cards/vivaplus.png" },
  { id: "2now", label: "2Now", icon: "/cards/2now.png" },
  { id: "advance", label: "Advance", icon: "/cards/advance.png" },
  { id: "air", label: "Air", icon: "/cards/air.png" },
  { id: "premier", label: "Premier", icon: "/cards/premier.png" },
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
  { id: "vip", label: "VIP / Premier", help: "Tono más sobrio y premium." },
  { id: "morosos", label: "Con adeudo", help: "Firme pero respetuoso." },
] as const;

const URGENCIES = [
  { id: "baja", label: "Baja", help: "Informativo, sin presión." },
  { id: "media", label: "Media", help: "Llamada a la acción clara, sin alarmar." },
  { id: "alta", label: "Alta", help: "Acción inmediata, enfatiza tiempos." },
] as const;

const TONES = [
  { id: "informativo", label: "Informativo" },
  { id: "cercano", label: "Cercano" },
  { id: "celebratorio", label: "Celebratorio" },
  { id: "urgente", label: "Urgente" },
  { id: "formal", label: "Formal" },
] as const;

type CopyField = keyof DraftCopy;

/**
 * The wizard's ordered list of steps. `required` controls whether the user
 * can skip to the next step. `keyInfo` is optional (some notifications have
 * no hard data to pin down).
 */
const WIZARD_STEPS = [
  { id: "product", required: true },
  { id: "objective", required: true },
  { id: "topic", required: true },
  { id: "keyInfo", required: false },
  { id: "audience", required: true },
  { id: "urgency", required: true },
  { id: "tone", required: true },
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
      return true; // optional
    case "audience":
      return Boolean(brief.audience);
    case "urgency":
      return Boolean(brief.urgency);
    case "tone":
      return Boolean(brief.tone);
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
    pdf?: "piece" | "presentation";
  }>({});
  const [error, setError] = useState<string | null>(null);
  const [imageQuery, setImageQuery] = useState<string>("");
  const [imageResults, setImageResults] = useState<FreepikImage[]>([]);
  const [isPending, startTransition] = useTransition();

  // Brief collapses automatically when there's already generated copy (i.e.,
  // the user has gone through the first generation). They can re-open it
  // anytime to tweak the inputs.
  const [briefOpen, setBriefOpen] = useState<boolean>(!draft.copy.subject);

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
   * Fetch the PDF from /api/drafts/[id]/pdf and trigger a browser download.
   * We fetch + blob (instead of `window.location = url`) so we can show a
   * loading state and surface server errors as a toast instead of leaving
   * the user staring at a broken tab.
   */
  async function onDownloadPdf(mode: "piece" | "presentation") {
    setBusy((b) => ({ ...b, pdf: mode }));
    setError(null);
    try {
      const res = await fetch(`/api/drafts/${draft.id}/pdf?mode=${mode}`, {
        method: "GET",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({ error: res.statusText }));
        throw new Error(data.error ?? "Falló la generación del PDF.");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      // Pull the filename out of Content-Disposition so we mirror what the
      // server chose (slugified draft name).
      const cd = res.headers.get("Content-Disposition") ?? "";
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match?.[1] ?? `notificacion-${mode}.pdf`;
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falló la descarga del PDF.");
    } finally {
      setBusy((b) => ({ ...b, pdf: undefined }));
    }
  }

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* TOP BAR: brief wizard — conversational step-by-step (Claude-design style).
          Each step is its own focused screen with a big question, an answer
          input, and progress dots + back/next buttons.
          When closed it disappears completely and only a small "Editar brief"
          button remains in the toolbar so copy + preview get the full screen. */}
      {briefOpen && (
        <div className="flex flex-1 overflow-y-auto bg-gradient-to-b from-neutral-50/80 to-white">
          <div className="mx-auto flex w-full max-w-3xl flex-col justify-center px-6 py-12">
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
            <div className="min-h-[280px]">
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
                          onClick={() => setBrief({ ...brief, product: p.id })}
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
                            setBrief({ ...brief, objective: o.id });
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
                  <p className="mt-1.5 text-[11px] text-neutral-500">
                    Mínimo 10 caracteres.{" "}
                    <span className="text-neutral-400">({(brief.topic ?? "").trim().length})</span>
                  </p>
                </WizardStep>
              )}

              {currentStep.id === "keyInfo" && (
                <WizardStep
                  title="¿Hay datos que SÍ o SÍ deben aparecer?"
                  hint="Opcional. Fechas, montos, últimos 4 de la tarjeta, IDs de rastreo. Evita que Claude se invente cosas."
                >
                  <textarea
                    autoFocus
                    value={brief.keyInfo ?? ""}
                    onChange={(e) => setBrief({ ...brief, keyInfo: e.target.value })}
                    rows={4}
                    placeholder="Ej. Fecha de corte: 15 de junio. Monto mínimo: $1,250. Tarjeta terminación 4823."
                    className="focus:border-brand-600 focus:ring-brand-600/15 w-full rounded-lg border border-neutral-300 bg-white px-3.5 py-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
                  />
                  <p className="mt-1.5 text-[11px] text-neutral-500">
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
                            setBrief({ ...brief, audience: a.id });
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
                          onClick={() => setBrief({ ...brief, urgency: u.id })}
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

              {currentStep.id === "tone" && (
                <WizardStep
                  title="¿Con qué tono lo decimos?"
                  hint="El último ajuste antes de generar."
                >
                  <div className="flex flex-wrap gap-2">
                    {TONES.map((t) => {
                      const active = brief.tone === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setBrief({ ...brief, tone: t.id })}
                          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                            active
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50"
                          }`}
                        >
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </WizardStep>
              )}
            </div>

            {/* Navigation footer */}
            <div className="mt-6 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
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
                      onClick={() => setStepIdx((i) => Math.min(WIZARD_STEPS.length - 1, i + 1))}
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
              {/* PDF downloads — only enable after copy exists. */}
              <button
                type="button"
                onClick={() => onDownloadPdf("piece")}
                disabled={!copy.subject || busy.pdf !== undefined}
                className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
                title="Descargar solo el email como PDF"
              >
                {busy.pdf === "piece" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <FileText className="h-3 w-3" />
                )}
                PDF · Solo pieza
              </button>
              <button
                type="button"
                onClick={() => onDownloadPdf("presentation")}
                disabled={!copy.subject || busy.pdf !== undefined}
                className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
                title="Descargar deck completo para revisión de HSBC"
              >
                {busy.pdf === "presentation" ? (
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
            <section className="overflow-y-auto bg-neutral-100">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-neutral-200 bg-neutral-100/95 px-5 py-2.5 backdrop-blur">
                <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  Preview HSBC
                </div>
              </div>
              <div className="p-5">
                <div className="mx-auto max-w-[640px] overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
                  <iframe
                    title="Email preview"
                    srcDoc={previewHtml}
                    className="block h-[calc(100vh-12rem)] w-full border-0"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </section>
          </div>
        </>
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
