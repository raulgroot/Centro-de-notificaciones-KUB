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
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Loader2,
  Pencil,
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

const LIFECYCLES = [
  { id: "emitted", label: "Emitida" },
  { id: "transit", label: "En tránsito" },
  { id: "delivered", label: "Entregada" },
  { id: "activation", label: "Activación" },
  { id: "problem", label: "Problema" },
] as const;

const TONES = [
  { id: "informativo", label: "Informativo" },
  { id: "celebratorio", label: "Celebratorio" },
  { id: "urgente", label: "Urgente" },
  { id: "formal", label: "Formal" },
] as const;

type CopyField = keyof DraftCopy;

/** Has the brief been filled enough to be considered "complete"? */
function isBriefComplete(b: DraftBrief): boolean {
  return Boolean(b.product && b.lifecycle && (b.topic ?? b.context));
}

export function DraftEditor({ draft }: { draft: NotificationDraft }) {
  const [brief, setBrief] = useState<DraftBrief>(draft.brief);
  const [copy, setCopy] = useState<DraftCopy>(draft.copy);
  const [heroImage, setHeroImage] = useState<DraftHeroImage | null>(draft.heroImage);
  const [busy, setBusy] = useState<{ generate?: boolean; refine?: CopyField; search?: boolean }>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [imageQuery, setImageQuery] = useState<string>("");
  const [imageResults, setImageResults] = useState<FreepikImage[]>([]);
  const [isPending, startTransition] = useTransition();

  // Brief collapses automatically when there's already generated copy (i.e.,
  // the user has gone through the first generation). They can re-open it
  // anytime to tweak the inputs.
  const [briefOpen, setBriefOpen] = useState<boolean>(!draft.copy.subject);

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

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* TOP BAR: brief — when open it's a wizard; when closed it disappears
          completely and only a small "Editar brief" button remains floating
          near the header so it doesn't compete with copy + preview. */}
      {briefOpen && (
        <div className="shrink-0 border-b border-neutral-200 bg-neutral-50/60">
          <div className="mx-auto max-w-5xl p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-neutral-900">
                  Crea tu notificación HSBC
                </h2>
                <p className="mt-0.5 text-xs text-neutral-600">
                  Solo dime sobre qué se trata y el tono. Yo me encargo del resto.
                </p>
              </div>
              {isBriefComplete(brief) && (
                <button
                  type="button"
                  onClick={() => setBriefOpen(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Cerrar
                </button>
              )}
            </div>

            {/* PRODUCT — card-icon picker */}
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Producto
              </div>
              <div className="flex flex-wrap gap-2">
                {PRODUCTS.map((p) => {
                  const active = brief.product === p.id;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setBrief({ ...brief, product: p.id })}
                      className={`group inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-brand-600 bg-brand-50 text-brand-700 ring-brand-600/15 ring-2"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.icon} alt="" className="h-6 w-9 object-contain" />
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* LIFECYCLE — chip picker */}
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Etapa del ciclo
              </div>
              <div className="flex flex-wrap gap-2">
                {LIFECYCLES.map((l) => {
                  const active = brief.lifecycle === l.id;
                  return (
                    <button
                      key={l.id}
                      type="button"
                      onClick={() => setBrief({ ...brief, lifecycle: l.id })}
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {l.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* TOPIC — textarea */}
            <div className="mb-4">
              <label
                htmlFor="topic"
                className="mb-1.5 block text-[11px] font-semibold tracking-wider text-neutral-500 uppercase"
              >
                ¿De qué se trata la notificación?
              </label>
              <textarea
                id="topic"
                value={brief.topic ?? ""}
                onChange={(e) => setBrief({ ...brief, topic: e.target.value })}
                rows={4}
                placeholder="Ej. Avisar al cliente que su tarjeta VIVA ya fue generada y le llegará en 5-10 días hábiles. Mencionar que puede rastrearla. Recordar que si necesita actualizar la dirección, hay un botón directo."
                className="focus:border-brand-600 focus:ring-brand-600/15 w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
              />
            </div>

            {/* TONE — chip picker */}
            <div className="mb-4">
              <div className="mb-1.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Tono
              </div>
              <div className="flex flex-wrap gap-2">
                {TONES.map((t) => {
                  const active = brief.tone === t.id;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setBrief({ ...brief, tone: t.id })}
                      className={`inline-flex items-center rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                        active
                          ? "border-brand-600 bg-brand-600 text-white"
                          : "border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300"
                      }`}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Action: generate */}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-200 pt-4">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                {isPending ? "Guardando…" : "Guardado automáticamente"}
              </div>
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy.generate || !brief.product || !brief.lifecycle}
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
            </div>

            {error && (
              <div className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating "Editar brief" button when brief is collapsed. */}
      {!briefOpen && (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-neutral-200 bg-white px-5 py-2">
          <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
            {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
            {isPending ? "Guardando…" : "Guardado automáticamente"}
          </div>
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
      )}

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
    </div>
  );
}

/* ─────────────────── tiny field components ─────────────────── */

function ComboField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-medium text-neutral-700">
        {label}
      </label>
      <input
        id={id}
        list={`${id}-options`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus:border-brand-600 focus:ring-brand-600/15 mt-1 h-9 w-full rounded-md border border-neutral-300 bg-white px-2.5 text-sm focus:ring-2 focus:outline-none"
      />
      <datalist id={`${id}-options`}>
        {options.map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  );
}

function TextareaField({
  id,
  label,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="block text-[11px] font-medium text-neutral-700">
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="focus:border-brand-600 focus:ring-brand-600/15 mt-1 w-full rounded-md border border-neutral-300 bg-white px-2.5 py-2 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
      />
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
