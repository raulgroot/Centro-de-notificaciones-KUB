"use client";

import { useState, useTransition, useRef } from "react";
import {
  CheckCircle2,
  Clock,
  Ban,
  FileQuestion,
  ExternalLink,
  Upload,
  X,
  Bell,
  Loader2,
} from "lucide-react";
import { processQASheet, saveQABatch, type QARow, type QAResult } from "./actions";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

const dayFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

type Status = QARow["status"];

const STATUS_META: Record<Status, { label: string; tone: string; Icon: typeof CheckCircle2 }> = {
  ready: {
    label: "QA listo",
    tone: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Icon: CheckCircle2,
  },
  pending: {
    label: "Pendiente",
    tone: "bg-amber-50 text-amber-700 border-amber-200",
    Icon: Clock,
  },
  "no-sends": {
    label: "Sin envíos",
    tone: "bg-neutral-100 text-neutral-600 border-neutral-200",
    Icon: Ban,
  },
  "not-found": {
    label: "No encontrada en Kublau",
    tone: "bg-red-50 text-red-700 border-red-200",
    Icon: FileQuestion,
  },
};

function StatusPill({ status }: { status: Status }) {
  const { label, tone, Icon } = STATUS_META[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${tone}`}
    >
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

/** Hoy en formato YYYY-MM-DD usando el TZ de CDMX (sin DST desde 2022). */
function todayInCDMX(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date());
}

export function QAClient() {
  const [result, setResult] = useState<QAResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<QARow | null>(null);
  const [referenceDate, setReferenceDate] = useState<string>(todayInCDMX());
  const [isPending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) {
      setResult({ ok: false, error: "Selecciona un archivo primero." });
      return;
    }
    setFileName(file.name);
    startTransition(async () => {
      const r = await processQASheet(fd);
      setResult(r);
    });
  };

  const reset = () => {
    setResult(null);
    setSelectedRow(null);
    setFileName(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      {/* Upload zone */}
      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">Sube tu hoja de QA</h2>
          <p className="mt-1 text-xs text-neutral-600">
            Indica cuándo subiste los cambios y carga la lista de themes. Te marco cada uno como{" "}
            <span className="font-semibold text-emerald-700">listo</span> (ya se mandó después de tu
            fecha) o <span className="font-semibold text-amber-700">pendiente</span> (aún no sale
            con los cambios).
          </p>
        </div>

        {/* Fecha de referencia — el corazón del flujo. La pongo arriba
            visible para que el usuario no se la salte. Default: hoy CDMX. */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <div>
            <label
              htmlFor="qa-date"
              className="block text-[11px] font-semibold tracking-wider text-neutral-600 uppercase"
            >
              Fecha de subida de cambios
            </label>
            <input
              id="qa-date"
              name="referenceDate"
              type="date"
              required
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
              className="focus:border-brand-600 focus:ring-brand-600/15 mt-1 h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm focus:ring-2 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-neutral-500">
              Cualquier envío después de esta fecha cuenta como &ldquo;listo&rdquo;.
            </p>
          </div>

          <div>
            <label
              htmlFor="qa-file"
              className="block text-[11px] font-semibold tracking-wider text-neutral-600 uppercase"
            >
              Archivo Excel
            </label>
            <div className="mt-1 flex items-center gap-2">
              <label
                htmlFor="qa-file"
                className="inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                <Upload className="h-4 w-4" />
                {fileName ? "Cambiar archivo" : "Seleccionar archivo"}
              </label>
              <input
                ref={inputRef}
                id="qa-file"
                name="file"
                type="file"
                accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                className="hidden"
                onChange={(e) => {
                  const f = e.currentTarget.files?.[0];
                  setFileName(f?.name ?? null);
                  setResult(null);
                }}
              />
              {fileName && (
                <span className="truncate font-mono text-[11px] text-neutral-500">{fileName}</span>
              )}
            </div>
            <p className="mt-1 text-[11px] text-neutral-500">
              Primera columna con el{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[10px]">
                NOMBRE DE THEME/TRIGGER
              </code>
              . Si traes <code className="text-[10px]">FECHA DE MODIFICACIÓN</code> en otra columna,
              esa fecha pisa la global por fila.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={isPending || !fileName}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-9 items-center gap-2 rounded-md px-4 text-xs font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isPending ? "Procesando…" : "Analizar"}
            </button>
            {result && (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-600 transition hover:bg-neutral-50"
              >
                Reiniciar
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Error */}
      {result && !result.ok && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {result.error}
        </div>
      )}

      {/* Warnings */}
      {result?.ok && result.warnings.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
          <div className="font-semibold">Avisos durante la lectura:</div>
          <ul className="mt-1 list-inside list-disc space-y-0.5">
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Results */}
      {result?.ok && result.rows.length > 0 && (
        <>
          <SaveBatchPanel
            referenceDate={result.referenceDate}
            rows={result.rows}
            defaultName={fileName?.replace(/\.(xlsx|xls)$/i, "") ?? ""}
          />
          <ResultsTable
            rows={result.rows}
            referenceDate={result.referenceDate}
            onSelect={setSelectedRow}
          />
        </>
      )}

      {/* Preview drawer */}
      {selectedRow && <PreviewDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

/**
 * Panel "Guardar este QA" — aparece solo después de analizar. Persiste
 * los resultados en Supabase para que el cron horario los monitoree y
 * disparé notificaciones cuando un theme transicione de pendiente a listo.
 */
function SaveBatchPanel({
  referenceDate,
  rows,
  defaultName,
}: {
  referenceDate: Date | null;
  rows: QARow[];
  defaultName: string;
}) {
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<null | { batchId: string }>(null);
  const [error, setError] = useState<string | null>(null);

  const pending = rows.filter((r) => r.status === "pending").length;
  const noSends = rows.filter((r) => r.status === "no-sends").length;
  const monitorable = pending + noSends;

  if (saved) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div className="flex-1">
            <div className="font-semibold">QA guardado</div>
            <p className="mt-1 text-xs">
              Te aviso en el bell del top bar cuando cada pieza pendiente empiece a salir. Revisas
              el inbox completo en{" "}
              <a href="/alertas" className="font-semibold underline underline-offset-2">
                /alertas
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function onSave() {
    if (!referenceDate) {
      setError("No hay fecha de referencia para guardar el batch.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const r = await saveQABatch({
        name: name.trim() || "QA sin nombre",
        referenceDateIso: referenceDate.toISOString(),
        rows: rows.map((row) => ({
          themeName: row.themeName,
          status: row.status,
          lastSentAt: row.lastSentAt,
        })),
      });
      if (r.ok) setSaved({ batchId: r.batchId });
      else setError(r.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border-brand-200 bg-brand-50/40 rounded-lg border p-4">
      <div className="flex items-start gap-3">
        <Bell className="text-brand-700 mt-0.5 h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="text-sm font-semibold text-neutral-900">
            ¿Guardar este QA para recibir avisos?
          </div>
          <p className="mt-1 text-xs text-neutral-600">
            {monitorable > 0 ? (
              <>
                Te aviso en el bell del top bar cuando cualquiera de las{" "}
                <strong>{monitorable}</strong> piezas pendientes / sin-envíos transicione a listo.
                Cron horario.
              </>
            ) : (
              <>Todas las piezas ya están listas. Aún así puedes guardarlo como histórico.</>
            )}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre del batch (ej. Renovaciones mayo)"
              className="focus:border-brand-600 focus:ring-brand-600/15 h-8 min-w-[200px] flex-1 rounded-md border border-neutral-300 bg-white px-2.5 text-xs focus:ring-2 focus:outline-none"
            />
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="bg-brand-600 hover:bg-brand-700 inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Guardando…
                </>
              ) : (
                <>
                  <Bell className="h-3 w-3" />
                  Guardar y avisarme
                </>
              )}
            </button>
          </div>
          {error && (
            <div className="mt-2 rounded-md bg-red-50 px-2 py-1 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultsTable({
  rows,
  referenceDate,
  onSelect,
}: {
  rows: QARow[];
  referenceDate: Date | null;
  onSelect: (r: QARow) => void;
}) {
  const summary: Record<Status, number> = {
    ready: 0,
    pending: 0,
    "no-sends": 0,
    "not-found": 0,
  };
  for (const r of rows) summary[r.status]++;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-neutral-600">
          {rows.length} {rows.length === 1 ? "fila" : "filas"} analizadas
          {referenceDate ? (
            <>
              {" "}
              vs. <strong className="text-neutral-900">{dayFmt.format(referenceDate)}</strong>:
            </>
          ) : (
            ":"
          )}
        </span>
        {(Object.keys(summary) as Status[]).map((s) =>
          summary[s] > 0 ? (
            <span key={s} className="inline-flex items-center gap-1">
              <StatusPill status={s} />
              <span className="font-semibold text-neutral-700">{summary[s]}</span>
            </span>
          ) : null,
        )}
      </div>
      <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-200 bg-neutral-50 text-left text-[11px] tracking-wider text-neutral-600 uppercase">
              <tr>
                <th className="px-4 py-2 font-semibold">Nombre del theme</th>
                <th className="px-4 py-2 font-semibold">Fecha de modificación</th>
                <th className="px-4 py-2 font-semibold">Último envío</th>
                <th className="px-4 py-2 font-semibold">Estado</th>
                <th className="px-4 py-2 font-semibold">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((r) => (
                <tr key={`${r.rowNumber}-${r.themeName}`} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5 align-top">
                    <div className="font-medium text-neutral-900">{r.themeName}</div>
                    {r.subject && (
                      <div className="mt-0.5 truncate text-[11px] text-neutral-500">
                        {r.subject}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 align-top text-xs whitespace-nowrap text-neutral-600">
                    {r.modifiedAt ? dayFmt.format(r.modifiedAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top text-xs whitespace-nowrap text-neutral-600">
                    {r.lastSentAt ? dateFmt.format(r.lastSentAt) : "—"}
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-2.5 align-top">
                    <button
                      type="button"
                      onClick={() => onSelect(r)}
                      disabled={!r.htmlBody}
                      className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 text-xs font-medium disabled:cursor-not-allowed disabled:text-neutral-400"
                    >
                      Ver HTML
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PreviewDrawer({ row, onClose }: { row: QARow; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="flex-1 bg-neutral-900/40 backdrop-blur-[1px]"
      />
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-neutral-200 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-neutral-900">{row.themeName}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
              <StatusPill status={row.status} />
              {row.lastSentAt && (
                <span>
                  Enviado: <strong>{dateFmt.format(row.lastSentAt)}</strong>
                </span>
              )}
              {row.recipient && (
                <span>
                  Destinatario: <code className="font-mono">{row.recipient}</code>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
            aria-label="Cerrar preview"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-5 py-2 text-xs">
          {row.postmarkUrl && (
            <a
              href={row.postmarkUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 font-medium"
            >
              <ExternalLink className="h-3 w-3" />
              Ver en Postmark
            </a>
          )}
          {row.themeLink && (
            <a
              href={row.themeLink}
              target="_blank"
              rel="noreferrer noopener"
              className="text-brand-600 hover:text-brand-700 inline-flex items-center gap-1 font-medium"
            >
              <ExternalLink className="h-3 w-3" />
              Abrir theme en Kublau
            </a>
          )}
        </div>

        <div className="flex-1 overflow-hidden bg-neutral-100 p-4">
          {row.htmlBody ? (
            <iframe
              title="Preview del correo"
              srcDoc={row.htmlBody}
              sandbox=""
              className="h-full w-full rounded-md border border-neutral-200 bg-white shadow-sm"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-neutral-500">
              No hay HTML disponible para este envío.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
