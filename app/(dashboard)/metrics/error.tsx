"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

/**
 * Route-level error boundary. The metrics page hits Kublau ClickHouse on every
 * render; when that infrastructure has a blip we want to show a calm fallback
 * with a retry button rather than a stack trace.
 */
export default function MetricsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort logging so we can correlate user reports with server logs.
    console.error("[metrics] render error", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-lg border border-amber-200 bg-amber-50 p-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100">
        <AlertTriangle className="h-5 w-5 text-amber-700" />
      </div>
      <h2 className="mt-3 text-base font-semibold text-amber-900">
        No pudimos cargar las métricas
      </h2>
      <p className="mt-1 text-sm text-amber-800">
        Probablemente la base de datos de Kublau está respondiendo lento o caída momentáneamente.
        Inténtalo de nuevo en unos segundos.
      </p>
      <button
        type="button"
        onClick={reset}
        className="bg-brand-600 hover:bg-brand-700 mt-4 inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-medium text-white transition"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reintentar
      </button>
    </div>
  );
}
