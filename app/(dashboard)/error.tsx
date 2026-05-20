"use client";

/**
 * Error boundary global del dashboard. Captura cualquier throw de async
 * server components (Kublau / Postmark / Supabase / Anthropic) y muestra
 * un fallback con botón Reintentar.
 *
 * El typical caso: alguna API se cae transitoriamente y sin boundary Next
 * muestra la pantalla negra "This page couldn't load" que ni siquiera
 * deja al usuario ver el ref ID. Con este boundary tenemos visibilidad
 * de qué falla y el usuario tiene un botón para reintentar.
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
    // Va a `vercel logs` para que podamos diagnosticar.
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

        {/* En cualquier ambiente mostramos el mensaje del error porque eso
            es lo que necesitamos para diagnosticar — es info read-only y
            esta plataforma es interna (solo equipo Kublau autenticado). */}
        {error.message && (
          <details className="mt-4 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-left text-xs">
            <summary className="cursor-pointer font-semibold text-neutral-700">
              Detalle del error (para debug)
            </summary>
            <pre className="mt-2 overflow-x-auto font-mono text-[11px] whitespace-pre-wrap text-neutral-600">
              {error.message}
              {process.env.NODE_ENV !== "production" && error.stack ? `\n\n${error.stack}` : ""}
            </pre>
          </details>
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
      </div>
    </div>
  );
}
