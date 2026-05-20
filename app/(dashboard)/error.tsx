"use client";

/**
 * Error boundary global para TODO el dashboard (cualquier ruta dentro del
 * grupo (dashboard) que no tenga su propio error.tsx cae aquí en vez de
 * tumbar la página con el default de Next.
 *
 * El typical caso de uso: API externa (Kublau / Postmark / Supabase) timea
 * o devuelve 5xx mientras el usuario navegaba rápido entre pantallas. Sin
 * este boundary el árbol entero se cae y Next muestra su error UI default.
 *
 * Lo dejamos minimal a propósito — botón "Reintentar" (el reset de Next)
 * y un link a Home por si el reintento sigue fallando.
 */

import { useEffect } from "react";
import Link from "next/link";
import { RefreshCw, Home, AlertTriangle } from "lucide-react";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Loguearemos a Vercel Logs / Sentry cuando lo configuremos. Por ahora
    // queda en console.error para que aparezca en `vercel logs`.
    console.error("[dashboard error boundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
          <AlertTriangle className="h-6 w-6 text-amber-700" />
        </div>

        <h1 className="mt-5 text-xl font-semibold tracking-tight text-neutral-900">
          Algo se rompió al cargar esta pantalla
        </h1>
        <p className="mt-2 text-sm text-neutral-600">
          Normalmente es una API que tardó (Kublau, Postmark, Supabase). Casi siempre se arregla
          intentando otra vez.
        </p>

        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-neutral-400">ref: {error.digest}</p>
        )}

        <div className="mt-6 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold text-white shadow-sm transition"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reintentar
          </button>
          <Link
            href="/notifications"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            <Home className="h-3.5 w-3.5" />
            Ir al inicio
          </Link>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <details className="mt-6 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-left text-xs">
            <summary className="cursor-pointer font-semibold text-neutral-700">
              Detalle del error (solo en dev)
            </summary>
            <pre className="mt-2 overflow-x-auto font-mono text-[11px] whitespace-pre-wrap text-neutral-600">
              {error.message}
              {error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}
