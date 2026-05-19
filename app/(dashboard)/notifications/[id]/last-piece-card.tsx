"use client";

/**
 * Card "Última pieza enviada" — preview del HTML real con friction
 * intencional. Default state: oculto detrás de un placeholder + warning.
 * Al hacer clic, modal de confirmación obligatoria. Solo después de
 * confirmar se carga el iframe.
 *
 * Diseñado para que NO sea casual de usar: contiene datos reales del
 * cliente (recipient masked) y links que en otra situación dispararían
 * tracking de Postmark y/o iniciar flujos reales. Solo para revisión
 * visual puntual.
 *
 * Defensa en profundidad:
 *   - El HTML ya viene sanitizado server-side (sanitize-preview.ts):
 *     hrefs removidos, forms neutralizados, tracking pixels reemplazados.
 *   - El iframe va sandboxed sin allow-scripts, allow-popups, allow-forms,
 *     allow-top-navigation, etc.
 *   - Banner persistente arriba mientras se ve.
 */

import { useState } from "react";
import { AlertTriangle, EyeOff, X, ShieldAlert } from "lucide-react";

export function LastPieceCard({
  sanitizedHtml,
  lastSentAt,
  recipientMasked,
}: {
  sanitizedHtml: string;
  lastSentAt: Date | null;
  recipientMasked: string | null;
}) {
  const [stage, setStage] = useState<"hidden" | "modal" | "revealed">("hidden");

  return (
    <>
      {/* CARD CONTAINER */}
      <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Última pieza enviada
            </div>
            <p className="mt-1 text-xs text-neutral-500">
              HTML exacto que recibió un cliente real. Solo para revisión visual.
            </p>
          </div>
          {stage === "revealed" && (
            <button
              type="button"
              onClick={() => setStage("hidden")}
              className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:bg-neutral-50"
            >
              <EyeOff className="h-3 w-3" />
              Ocultar
            </button>
          )}
        </div>

        {stage === "hidden" && (
          <button
            type="button"
            onClick={() => setStage("modal")}
            className="group flex w-full flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 bg-neutral-50 py-12 text-center transition hover:border-amber-400 hover:bg-amber-50/40"
          >
            <ShieldAlert className="h-7 w-7 text-amber-600 transition group-hover:scale-110" />
            <div>
              <div className="text-sm font-semibold text-neutral-900">
                Contenido sensible — clic para revelar
              </div>
              <p className="mt-1 max-w-md text-xs text-neutral-600">
                Esta pieza contiene datos reales del cliente y links rastreados. Confirma antes de
                mostrarla.
              </p>
            </div>
          </button>
        )}

        {stage === "revealed" && (
          <div className="overflow-hidden rounded-lg border border-amber-300">
            {/* Persistent warning banner. */}
            <div className="flex items-center gap-2 bg-amber-100 px-3 py-2 text-[11px] font-semibold tracking-wide text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span className="uppercase">Modo revisión</span>
              <span className="font-normal text-amber-800 normal-case">
                · Interacción deshabilitada · No hagas clic en links ni botones
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-y border-amber-200 bg-amber-50/60 px-3 py-1.5 text-[11px] text-neutral-600">
              <span>
                {recipientMasked ? (
                  <>
                    Enviado a: <span className="font-mono">{recipientMasked}</span>
                  </>
                ) : (
                  "Destinatario desconocido"
                )}
              </span>
              <span>
                {lastSentAt
                  ? new Intl.DateTimeFormat("es-MX", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(lastSentAt)
                  : "Fecha desconocida"}
              </span>
            </div>
            <iframe
              title="Última pieza enviada — preview read-only"
              srcDoc={sanitizedHtml}
              className="block h-[720px] w-full border-0 bg-white"
              // Mínimo posible: same-origin para que cargue resources, NADA
              // de scripts / forms / top-navigation / popups. Defensa en
              // profundidad sobre la sanitización HTML.
              sandbox="allow-same-origin"
              referrerPolicy="no-referrer"
            />
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL */}
      {stage === "modal" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            className="relative w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setStage("hidden")}
              aria-label="Cerrar"
              className="absolute top-3 right-3 rounded-md p-1 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-700" />
              </div>
              <div className="flex-1">
                <h2 id="confirm-title" className="text-base font-semibold text-neutral-900">
                  Vas a ver una pieza real
                </h2>
                <p className="mt-1 text-sm text-neutral-600">
                  Esta es la copia exacta de un email enviado a un cliente real. Antes de continuar,
                  ten en cuenta:
                </p>
              </div>
            </div>

            <ul className="mt-4 space-y-2 rounded-lg bg-amber-50 p-3 text-[13px] text-amber-900">
              <li className="flex items-start gap-2">
                <span className="select-none">🚫</span>
                <span>
                  <strong>No hagas clic</strong> en ningún link ni botón — podrías iniciar un flujo
                  real del cliente.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="select-none">📊</span>
                <span>
                  Aunque deshabilitamos los clicks, cualquier interacción accidental podría{" "}
                  <strong>alterar métricas</strong> de Postmark.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="select-none">👁</span>
                <span>
                  Usa esta vista <strong>solo para revisión visual</strong> — cómo se ve, copy,
                  imágenes. Nada más.
                </span>
              </li>
            </ul>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setStage("hidden")}
                className="rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setStage("revealed")}
                className="rounded-md bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700"
              >
                Entiendo, mostrar pieza
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
