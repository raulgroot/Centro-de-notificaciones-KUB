"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Loader2 } from "lucide-react";

/**
 * Botón "Refrescar ahora" — dispara manualmente el cron de QA en
 * caliente. Útil cuando el usuario sabe que HSBC mandó cosas recién y no
 * quiere esperar al cron diario.
 *
 * Pega a /api/qa/check-batches (la misma ruta que corre el cron), espera
 * el resultado, y refresca la página para que aparezcan las nuevas
 * notifs detectadas.
 */
export function RefreshNowButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<string | null>(null);

  async function onClick() {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await fetch("/api/qa/check-batches", { method: "POST" });
        const data = (await r.json()) as
          | {
              ok: true;
              stats: {
                itemsChecked: number;
                transitionsDetected: number;
                errorsSkipped: number;
              };
            }
          | { ok: false; error: string };
        if (!data.ok) {
          setResult(`Error: ${data.error}`);
          return;
        }
        const { transitionsDetected, itemsChecked } = data.stats;
        if (transitionsDetected > 0) {
          setResult(`✓ ${transitionsDetected} pieza(s) nueva(s) detectadas.`);
        } else if (itemsChecked === 0) {
          setResult("No tienes QA pendientes que monitorear.");
        } else {
          setResult(`Revisé ${itemsChecked} pieza(s) pendientes — ninguna ha salido aún.`);
        }
        // Refresh server components so el inbox y el bell se actualicen.
        router.refresh();
      } catch (e) {
        setResult(`Error: ${e instanceof Error ? e.message : String(e)}`);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" />
        )}
        {pending ? "Revisando…" : "Refrescar ahora"}
      </button>
      {result && <span className="text-[11px] text-neutral-500">{result}</span>}
    </div>
  );
}
