"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface SyncResult {
  ok: boolean;
  imported?: number;
  importedFromName?: number;
  updated?: number;
  scanned?: number;
  missingDate?: Array<{ taskName: string; permalinkUrl: string }>;
  campaignsFailed?: Array<{ campaignId: string; error: string }>;
  error?: string;
}

/**
 * Button that hits POST /api/sync-campaigns. Renders a compact result panel
 * underneath: number imported/updated, list of tasks missing due date, and
 * any per-campaign errors.
 */
export function AsanaSyncButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<SyncResult | null>(null);

  const onSync = () => {
    setResult(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/sync-campaigns", { method: "POST" });
        const json = (await res.json()) as SyncResult;
        setResult(json);
        if (json.ok) router.refresh();
      } catch (e) {
        setResult({ ok: false, error: e instanceof Error ? e.message : "Error de red" });
      }
    });
  };

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={onSync}
        disabled={isPending}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-[#F06A6A] bg-white px-3 text-xs font-medium text-[#F06A6A] transition hover:bg-[#FEF2F2] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Sincronizando…" : "Sincronizar desde Asana"}
      </button>

      {result && <SyncResultPanel result={result} />}
    </div>
  );
}

function SyncResultPanel({ result }: { result: SyncResult }) {
  if (!result.ok) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-800">
        <div className="flex items-start gap-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            <strong>Error en la sincronización:</strong> {result.error ?? "desconocido"}
            {result.error?.includes("ASANA_TOKEN_INVALID") && (
              <div className="mt-1 text-[11px] text-red-700">
                El PAT está mal o expiró. Verifica el valor en{" "}
                <code className="rounded bg-red-100 px-1">.env.local</code>.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const imported = result.imported ?? 0;
  const importedFromName = result.importedFromName ?? 0;
  const updated = result.updated ?? 0;
  const scanned = result.scanned ?? 0;
  const missing = result.missingDate ?? [];
  const failed = result.campaignsFailed ?? [];
  const totalImported = imported + importedFromName;

  return (
    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-700" />
        <div className="min-w-0 flex-1">
          <strong>Sincronización completada.</strong> {scanned} task{scanned === 1 ? "" : "s"}{" "}
          revisado{scanned === 1 ? "" : "s"} · <strong>{totalImported}</strong> nueva
          {totalImported === 1 ? "" : "s"} · <strong>{updated}</strong> actualizada
          {updated === 1 ? "" : "s"}.
          {importedFromName > 0 && (
            <div className="mt-1 text-[11px] text-emerald-800">
              {importedFromName === 1
                ? "1 fecha obtenida del nombre del task (sin due_date en Asana)."
                : `${importedFromName} fechas obtenidas del nombre del task (sin due_date en Asana).`}
            </div>
          )}
          {missing.length > 0 && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">
              <div className="font-semibold">
                ⚠️ {missing.length} task{missing.length === 1 ? "" : "s"} sin due date (omitido
                {missing.length === 1 ? "" : "s"}):
              </div>
              <ul className="mt-1 space-y-0.5">
                {missing.slice(0, 5).map((m) => (
                  <li key={m.permalinkUrl} className="flex items-baseline gap-2">
                    <span className="truncate">{m.taskName}</span>
                    <a
                      href={m.permalinkUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="shrink-0 text-[11px] underline hover:no-underline"
                    >
                      abrir
                    </a>
                  </li>
                ))}
                {missing.length > 5 && (
                  <li className="text-[11px] italic">y {missing.length - 5} más…</li>
                )}
              </ul>
              <div className="mt-1 text-[11px]">
                Pídele a Uriel que les agregue due date en Asana y vuelve a sincronizar.
              </div>
            </div>
          )}
          {failed.length > 0 && (
            <div className="mt-2 rounded border border-red-200 bg-red-50 p-2 text-red-800">
              <div className="font-semibold">Campañas con error:</div>
              <ul className="mt-1 space-y-0.5">
                {failed.map((f) => (
                  <li key={f.campaignId}>
                    <strong>{f.campaignId}</strong>: {f.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
