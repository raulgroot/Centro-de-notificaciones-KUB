"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const relativeFmt = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

const relativeLabel = (d: Date | null, now: number): string => {
  if (!d) return "sin datos";
  const diffMin = Math.round((d.getTime() - now) / 60_000);
  if (Math.abs(diffMin) < 1) return "justo ahora";
  if (Math.abs(diffMin) < 60) return relativeFmt.format(diffMin, "minute");
  if (Math.abs(diffMin) < 60 * 24) return relativeFmt.format(Math.round(diffMin / 60), "hour");
  return relativeFmt.format(Math.round(diffMin / 60 / 24), "day");
};

/**
 * Header for the /metrics page: shows when the snapshot was taken and a
 * button to refresh manually. The relative timestamp uses `now` from a prop
 * (computed server-side) so first render is deterministic.
 */
export function MetricsRefreshButton({
  snapshottedAt,
  now,
}: {
  snapshottedAt: Date | null;
  now: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const onRefresh = () => {
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/refresh-metrics", { method: "POST" });
        const json = (await res.json()) as { ok: boolean; error?: string };
        if (!json.ok) {
          setError(json.error ?? "No se pudo refrescar.");
        } else {
          router.refresh();
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error de red");
      }
    });
  };

  return (
    <div className="flex items-center gap-3 text-xs">
      <div className="text-neutral-500">
        Datos del{" "}
        <span className="font-medium text-neutral-700">{relativeLabel(snapshottedAt, now)}</span>
        {snapshottedAt && (
          <span className="ml-1 text-neutral-400">
            ({snapshottedAt.toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })})
          </span>
        )}
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isPending}
        className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Refrescando…" : "Refrescar"}
      </button>
      {error && <span className="text-red-700">{error}</span>}
    </div>
  );
}
