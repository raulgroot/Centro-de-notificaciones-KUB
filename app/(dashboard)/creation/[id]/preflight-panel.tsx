"use client";

/**
 * Panel de pre-flight Premier. Se abre cuando el usuario pulsa "Revisar"
 * (no es un linter en vivo): toma el resultado ya calculado de
 * `runPreflight` y lo presenta como un drawer lateral derecho.
 *
 * Decisiones de diseño (acordadas con Raúl):
 *   - Panel que se ABRE bajo demanda (no siempre visible).
 *   - La validación corre DESPUÉS de generar/editar el copy, no por carácter.
 *
 * Severidades:
 *   - blocking   (rosa)  → gatea "Enviar a revisión".
 *   - warning    (ámbar) → revisa, pero puedes avanzar.
 *   - suggestion (azul)  → opcional.
 */

import { useEffect } from "react";
import { AlertTriangle, CircleAlert, Info, ShieldCheck, X } from "lucide-react";
import type { Finding, PreflightResult, Severity } from "@/lib/notifications/premier-check";

const SEVERITY_META: Record<
  Severity,
  { label: string; icon: typeof AlertTriangle; cls: string; dot: string; badge: string }
> = {
  blocking: {
    label: "Bloqueante",
    icon: CircleAlert,
    cls: "border-rose-200 bg-rose-50",
    dot: "text-rose-600",
    badge: "bg-rose-100 text-rose-700",
  },
  warning: {
    label: "Advertencia",
    icon: AlertTriangle,
    cls: "border-amber-200 bg-amber-50",
    dot: "text-amber-600",
    badge: "bg-amber-100 text-amber-700",
  },
  suggestion: {
    label: "Sugerencia",
    icon: Info,
    cls: "border-sky-200 bg-sky-50",
    dot: "text-sky-600",
    badge: "bg-sky-100 text-sky-700",
  },
};

const SEVERITY_ORDER: Severity[] = ["blocking", "warning", "suggestion"];

function FindingCard({ finding }: { finding: Finding }) {
  const meta = SEVERITY_META[finding.severity];
  const Icon = meta.icon;
  return (
    <div className={`rounded-lg border p-3 ${meta.cls}`}>
      <div className="flex items-start gap-2">
        <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${meta.dot}`} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {finding.field && (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold tracking-wider text-neutral-600 uppercase">
                {finding.field}
              </span>
            )}
            {finding.discriminatory && (
              <span className="rounded bg-rose-600 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-white uppercase">
                Alto riesgo
              </span>
            )}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-neutral-700">{finding.message}</p>
          {finding.match && (
            <p className="mt-1 text-[11px] text-neutral-500">
              Encontrado: <span className="font-mono text-neutral-700">“{finding.match}”</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function PreflightPanel({
  result,
  isPremier,
  onClose,
}: {
  result: PreflightResult;
  isPremier: boolean;
  onClose: () => void;
}) {
  // Cerrar con Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const { findings, counts, ok } = result;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Cerrar panel de revisión"
        onClick={onClose}
        className="absolute inset-0 bg-neutral-900/20"
      />
      {/* Drawer */}
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-neutral-200 bg-white shadow-xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-neutral-200 px-5 py-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-neutral-500" />
            <h2 className="text-sm font-semibold text-neutral-900">Revisión de marca</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Verdict */}
        <div className="shrink-0 px-5 py-4">
          <div
            className={`rounded-lg border p-3 ${
              ok ? "border-emerald-200 bg-emerald-50" : "border-rose-200 bg-rose-50"
            }`}
          >
            <p className={`text-sm font-semibold ${ok ? "text-emerald-700" : "text-rose-700"}`}>
              {ok ? "Lista para enviar a revisión" : "Hay puntos bloqueantes por resolver"}
            </p>
            <p className="mt-0.5 text-xs text-neutral-600">
              {isPremier
                ? "Validado contra las reglas HSBC Premier (segmento World Elite)."
                : "Validación base HSBC (esta pieza no es Premier)."}
            </p>
          </div>

          {/* Count chips */}
          <div className="mt-3 flex flex-wrap gap-2">
            {SEVERITY_ORDER.map((sev) => {
              const n = counts[sev];
              const meta = SEVERITY_META[sev];
              return (
                <span
                  key={sev}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                    n > 0 ? meta.badge : "bg-neutral-100 text-neutral-400"
                  }`}
                >
                  {n} {meta.label.toLowerCase()}
                  {n === 1 ? "" : "s"}
                </span>
              );
            })}
          </div>
        </div>

        {/* Findings */}
        <div className="flex-1 space-y-2 overflow-y-auto px-5 pb-6">
          {findings.length === 0 ? (
            <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-4 text-center text-xs text-neutral-500">
              Sin observaciones. El copy cumple con las reglas validables.
            </div>
          ) : (
            findings.map((f) => <FindingCard key={f.id} finding={f} />)
          )}
        </div>
      </div>
    </div>
  );
}
