"use client";

import { useState, useTransition, useRef } from "react";
import { CheckCircle2, Clock, Ban, FileQuestion, ExternalLink, Upload, X } from "lucide-react";
import { processQASheet, type QARow, type QAResult } from "./actions";

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

export function QAClient() {
  const [result, setResult] = useState<QAResult | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<QARow | null>(null);
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
        className="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm"
      >
        <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-neutral-900">Sube tu hoja de QA</h2>
            <p className="mt-1 text-xs text-neutral-600">
              Formato esperado:{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
                NOMBRE DE THEME/TRIGGER
              </code>{" "}
              en la primera columna,{" "}
              <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">
                FECHA DE MODIFICACIÓN
              </code>{" "}
              opcional. Acepta <code className="text-[11px]">.xlsx</code> y{" "}
              <code className="text-[11px]">.xls</code>.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
        {fileName && (
          <div className="mt-3 text-[11px] text-neutral-500">
            Archivo seleccionado: <span className="font-mono">{fileName}</span>
          </div>
        )}
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
        <ResultsTable rows={result.rows} onSelect={setSelectedRow} />
      )}

      {/* Preview drawer */}
      {selectedRow && <PreviewDrawer row={selectedRow} onClose={() => setSelectedRow(null)} />}
    </div>
  );
}

function ResultsTable({ rows, onSelect }: { rows: QARow[]; onSelect: (r: QARow) => void }) {
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
          {rows.length} {rows.length === 1 ? "fila" : "filas"} analizadas:
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
