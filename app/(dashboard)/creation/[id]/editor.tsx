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

const PRODUCTS = ["viva", "vivaplus", "2now", "advance", "air", "premier", "clasica", "zero"];
const MOVEMENTS = [
  "alta nueva",
  "renovacion x vencimiento",
  "reposicion por maltrato",
  "cambio de producto upgrade",
  "trascodificadas",
];
const LIFECYCLES = ["emitted", "transit", "delivered", "activation", "problem"];
const TONES = ["informativo", "celebratorio", "urgente", "formal"];

type CopyField = keyof DraftCopy;

/** Has the brief been filled enough to be considered "complete"? */
function isBriefComplete(b: DraftBrief): boolean {
  return Boolean(b.product && b.movement && b.lifecycle);
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

  const previewHtml = useMemo(() => renderEmailHtml({ copy, heroImage }), [copy, heroImage]);

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

  const briefSummary = [
    brief.product,
    brief.movement,
    brief.lifecycle,
    brief.audience,
    brief.tone,
  ].filter((v): v is string => Boolean(v));

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* TOP BAR: brief — collapsible. When closed, shows a chip strip + Editar button. */}
      <div className="shrink-0 border-b border-neutral-200 bg-neutral-50/60">
        {briefOpen ? (
          <div className="p-5">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h2 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                  Brief
                </h2>
                <p className="mt-0.5 text-xs text-neutral-600">
                  Llena lo que sepas. Claude genera todo el copy a partir de aquí.
                </p>
              </div>
              {isBriefComplete(brief) && (
                <button
                  type="button"
                  onClick={() => setBriefOpen(false)}
                  className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
                  title="Ocultar brief"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                  Ocultar
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <ComboField
                id="product"
                label="Producto"
                value={brief.product ?? ""}
                options={PRODUCTS}
                onChange={(v) => setBrief({ ...brief, product: v })}
              />
              <ComboField
                id="movement"
                label="Movimiento"
                value={brief.movement ?? ""}
                options={MOVEMENTS}
                onChange={(v) => setBrief({ ...brief, movement: v })}
              />
              <ComboField
                id="lifecycle"
                label="Etapa"
                value={brief.lifecycle ?? ""}
                options={LIFECYCLES}
                onChange={(v) => setBrief({ ...brief, lifecycle: v })}
              />
              <ComboField
                id="audience"
                label="Audiencia"
                value={brief.audience ?? ""}
                options={["titular", "adicional", "empleado"]}
                onChange={(v) => setBrief({ ...brief, audience: v })}
              />
              <ComboField
                id="tone"
                label="Tono"
                value={brief.tone ?? ""}
                options={TONES}
                onChange={(v) => setBrief({ ...brief, tone: v })}
              />
              <TextareaField
                id="context"
                label="Contexto extra"
                value={brief.context ?? ""}
                placeholder="Ej. Segmento ONE; énfasis en seguridad."
                onChange={(v) => setBrief({ ...brief, context: v })}
              />
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                {isPending ? "Guardando…" : "Guardado automáticamente"}
              </div>
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy.generate}
                className="bg-brand-600 hover:bg-brand-700 inline-flex items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busy.generate ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generando…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generar copy con IA
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
        ) : (
          /* Collapsed brief: chip strip + Editar */
          <div className="flex flex-wrap items-center gap-2 px-5 py-3">
            <span className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Brief
            </span>
            {briefSummary.length === 0 ? (
              <span className="text-xs text-neutral-400">sin definir</span>
            ) : (
              briefSummary.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-neutral-700 ring-1 ring-neutral-200"
                >
                  {v}
                </span>
              ))
            )}
            <div className="ml-auto flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500">
                {isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                {isPending ? "Guardando…" : "Guardado"}
              </div>
              <button
                type="button"
                onClick={onGenerate}
                disabled={busy.generate}
                className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60"
                title="Re-generar copy con el brief actual"
              >
                {busy.generate ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                Re-generar
              </button>
              <button
                type="button"
                onClick={() => setBriefOpen(true)}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar brief
                <ChevronDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
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
