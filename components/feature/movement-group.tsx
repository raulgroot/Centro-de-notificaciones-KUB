"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { NotificationRecord } from "@/lib/ports/notification-source";
import type { MovementGroupSummary, ProductSubgroup } from "@/lib/core/notifications/grouping";
import { NotificationCard } from "./notification-card";

const COLLAPSED_VISIBLE_PER_SUBGROUP = 4;

/**
 * Collapsible section for one journey bucket (Renovación, Redirección, …),
 * with a second visual level for product sub-buckets (Viva, Viva Plus,
 * World Elite, …). When a movement has only one product subgroup the
 * sub-header collapses and we render the cards flat.
 *
 * Behavior:
 *  - The movement header toggles the whole section open/closed.
 *  - Each product sub-section shows COLLAPSED_VISIBLE_PER_SUBGROUP cards by
 *    default; a "Ver las N" button expands that sub-section only.
 */
export function MovementGroup({
  movement,
  items,
  summary,
  subgroups,
  defaultOpen = true,
}: {
  movement: string;
  items: NotificationRecord[];
  summary: MovementGroupSummary;
  subgroups: ProductSubgroup[];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const hasMultipleProducts = subgroups.length > 1;

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
            {summary.total.toLocaleString("es-MX")} ·{" "}
            {subgroups.length === 1 ? "1 producto" : `${subgroups.length} productos`}
          </span>
        </div>
        <Summary summary={summary} />
      </button>

      {open && (
        <div className="flex flex-col">
          {hasMultipleProducts ? (
            subgroups.map((sg) => <ProductSection key={sg.product} subgroup={sg} />)
          ) : (
            <FlatSection items={items} />
          )}
        </div>
      )}
    </section>
  );
}

/* ────────────── Single product → render cards flat with no header ────────────── */

function FlatSection({ items }: { items: NotificationRecord[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, COLLAPSED_VISIBLE_PER_SUBGROUP * 2);
  const hasMore = items.length > visible.length;

  return (
    <>
      <CardsGrid items={visible} />
      {hasMore && (
        <div className="border-t border-neutral-100 px-4 py-2.5 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            Ver las {items.length.toLocaleString("es-MX")}
          </button>
        </div>
      )}
    </>
  );
}

/* ────────────── Multi-product → sub-headers + per-section expansion ────────── */

function ProductSection({ subgroup }: { subgroup: ProductSubgroup }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded
    ? subgroup.items
    : subgroup.items.slice(0, COLLAPSED_VISIBLE_PER_SUBGROUP);
  const hasMore = subgroup.items.length > visible.length;

  return (
    <div className="border-b border-neutral-100 last:border-b-0">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-neutral-800">{subgroup.product}</h3>
        <span className="text-[11px] text-neutral-500">
          {subgroup.summary.total.toLocaleString("es-MX")}
        </span>
        <Summary summary={subgroup.summary} compact />
      </header>
      <CardsGrid items={visible} />
      {hasMore && (
        <div className="px-4 pt-1 pb-3 text-center">
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-xs font-medium text-neutral-600 transition hover:text-neutral-900"
          >
            Ver las {subgroup.items.length.toLocaleString("es-MX")} de {subgroup.product}
          </button>
        </div>
      )}
    </div>
  );
}

/* ────────────── Shared bits ────────── */

function CardsGrid({ items }: { items: NotificationRecord[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 pt-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {items.map((n) => (
        <NotificationCard key={n.id} n={n} />
      ))}
    </div>
  );
}

function Summary({
  summary,
  compact = false,
}: {
  summary: MovementGroupSummary;
  compact?: boolean;
}) {
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
    <div
      className={`hidden shrink-0 items-center sm:flex ${compact ? "gap-2 text-[10px]" : "gap-3 text-[11px]"}`}
    >
      {chips.map((c) => (
        <span key={c.label} className={`inline-flex items-center gap-1.5 ${c.text}`}>
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${c.dot}`} />
          <span className="font-semibold tabular-nums">{c.value}</span>
          {!compact && <span className="text-neutral-500">{c.label}</span>}
        </span>
      ))}
    </div>
  );
}
