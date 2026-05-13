"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NotificationRecord } from "@/lib/ports/notification-source";
import type { MovementGroupSummary } from "@/lib/core/notifications/grouping";
import { NotificationCard } from "./notification-card";

const COLLAPSED_VISIBLE = 8;

/**
 * Collapsible section for one journey bucket (Renovación, Redirección, …).
 * Defaults to showing the top N most recently-sent items; expand to show
 * everything in that group.
 */
export function MovementGroup({
  movement,
  items,
  summary,
  defaultOpen = true,
}: {
  movement: string;
  items: NotificationRecord[];
  summary: MovementGroupSummary;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_VISIBLE);
  const hasMore = items.length > COLLAPSED_VISIBLE;

  return (
    <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-4 border-b border-neutral-200 bg-neutral-50/60 px-5 py-3 text-left transition hover:bg-neutral-100/60"
      >
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
        <div className="flex min-w-0 flex-1 items-baseline gap-2.5">
          <h2 className="truncate text-base font-semibold text-neutral-900">{movement}</h2>
          <span className="text-xs text-neutral-500">
            {summary.total.toLocaleString("es-MX")} notificaciones
          </span>
        </div>
        <Summary summary={summary} />
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visible.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
        </div>
      )}

      {open && hasMore && (
        <div className="border-t border-neutral-100 px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            {expanded
              ? "Mostrar menos"
              : `Ver las ${items.length.toLocaleString("es-MX")} de ${movement}`}
          </button>
        </div>
      )}
    </section>
  );
}

function Summary({ summary }: { summary: MovementGroupSummary }) {
  const chips = [
    { label: "activas", value: summary.active, dot: "bg-emerald-500", text: "text-emerald-700" },
    { label: "inactivas", value: summary.inactive, dot: "bg-amber-500", text: "text-amber-700" },
    { label: "zombies", value: summary.zombie, dot: "bg-rose-500", text: "text-rose-700" },
    {
      label: "sin enviar",
      value: summary.never,
      dot: "bg-neutral-300",
      text: "text-neutral-500",
    },
  ].filter((c) => c.value > 0);

  return (
    <div className="hidden shrink-0 items-center gap-3 text-[11px] sm:flex">
      {chips.map((c) => (
        <span key={c.label} className={`inline-flex items-center gap-1.5 ${c.text}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot}`} />
          <span className="font-semibold tabular-nums">{c.value}</span>
          <span className="text-neutral-500">{c.label}</span>
        </span>
      ))}
    </div>
  );
}
