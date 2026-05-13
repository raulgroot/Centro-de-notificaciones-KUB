"use client";

import { useState, useTransition } from "react";
import { Plus, X } from "lucide-react";
import { createLoadAction } from "./actions";
import type { CampaignDefinition } from "@/lib/adapters/supabase/campaigns";

const todayISO = (): string => {
  const d = new Date();
  return d.toISOString().slice(0, 10);
};

/**
 * Collapsible "nueva carga" form. Hidden by default; toggles open with a
 * single button. Renders inside <form action={...}> so the server action
 * handles validation, insertion, and revalidation in one round-trip.
 */
export function NewLoadForm({ campaigns }: { campaigns: CampaignDefinition[] }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (campaigns.length === 0) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No hay campañas configuradas todavía. Agrega una en{" "}
        <code className="rounded bg-amber-100 px-1">/campanas/admin</code>.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-brand-600 hover:bg-brand-700 inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition"
      >
        <Plus className="h-4 w-4" />
        Nueva carga
      </button>
    );
  }

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const r = await createLoadAction(fd);
      if (!r.ok) {
        setError(r.error);
      } else {
        setOpen(false);
      }
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-neutral-900">Registrar nueva carga</h3>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100"
          aria-label="Cerrar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Campaña">
          <select
            name="campaignId"
            required
            defaultValue={campaigns[0]?.id ?? ""}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de carga">
          <input
            type="date"
            name="loadDate"
            required
            defaultValue={todayISO()}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Fecha límite (opcional)">
          <input
            type="date"
            name="deadline"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="URL de Asana (opcional)">
          <input
            type="url"
            name="asanaUrl"
            placeholder="https://app.asana.com/…"
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Notas (opcional)" className="md:col-span-2">
          <textarea
            name="notes"
            rows={2}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </Field>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-3 py-1.5 text-sm font-medium text-white transition disabled:opacity-50"
        >
          {isPending ? "Guardando…" : "Guardar carga"}
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}
