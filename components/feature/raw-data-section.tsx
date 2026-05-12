"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

/**
 * Collapsible wrapper for the raw charts/tables. Default state collapsed so the
 * insights-first layout stays clean; users opting in get the full historical
 * detail underneath.
 */
export function RawDataSection({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-3 text-left"
        aria-expanded={open}
      >
        <div>
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Datos crudos
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            Gráficas históricas y tabla completa de piezas. Para auditoría o exploración.
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 text-neutral-500" />
        ) : (
          <ChevronRight className="h-4 w-4 text-neutral-500" />
        )}
      </button>
      {open && <div className="space-y-6 border-t border-neutral-200 p-5">{children}</div>}
    </section>
  );
}
