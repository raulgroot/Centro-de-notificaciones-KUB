import Link from "next/link";
import { Search } from "lucide-react";
import type { NotificationFacets } from "@/lib/ports/notification-source";

const PAGE_SIZE = 50;

interface FiltersProps {
  facets: NotificationFacets;
  current: {
    search?: string;
    product?: string;
    movement?: string;
    clientType?: string;
    debit?: string;
    employee?: string;
    hasTheme?: string;
    status?: string;
    stage?: string;
    view?: string;
  };
}

const inputCls =
  "h-9 rounded-md border border-neutral-200 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15 focus:outline-none";

/**
 * Compact filter bar designed to live inside the notifications card so
 * filters + table feel like one cohesive panel.
 */
export function NotificationFilters({ facets, current }: FiltersProps) {
  const hasFilters = Object.values(current).some((v) => v && v !== "");

  return (
    <form
      method="get"
      className="flex flex-wrap items-center gap-2 border-b border-neutral-200 bg-neutral-50/50 px-5 py-3"
    >
      <div className="relative min-w-[260px] flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
        <input
          name="search"
          type="search"
          defaultValue={current.search ?? ""}
          placeholder="Buscar por asunto o theme…"
          className={`${inputCls} w-full pl-9`}
        />
      </div>

      <FilterSelect
        id="product"
        label="Producto"
        defaultValue={current.product}
        options={facets.products}
      />
      <FilterSelect
        id="movement"
        label="Movimiento"
        defaultValue={current.movement}
        options={facets.movements}
      />
      <FilterSelect
        id="clientType"
        label="Tipo cliente"
        defaultValue={current.clientType}
        options={facets.clientTypes}
      />
      <FilterSelect id="debit" label="Débito" defaultValue={current.debit} options={["SI", "NO"]} />
      <FilterSelect
        id="employee"
        label="Empleado"
        defaultValue={current.employee}
        options={["SI", "NO"]}
      />
      <FilterSelect
        id="status"
        label="Estado"
        defaultValue={current.status}
        options={[
          { value: "active", label: "Activas" },
          { value: "inactive", label: "Inactivas" },
          { value: "zombie", label: "Zombies" },
          { value: "never", label: "Sin enviar" },
        ]}
      />
      <FilterSelect
        id="stage"
        label="Etapa"
        defaultValue={current.stage}
        options={[
          { value: "emitted", label: "Emitida" },
          { value: "transit", label: "En tránsito" },
          { value: "delivered", label: "Entregada" },
          { value: "activation", label: "Activación" },
          { value: "problem", label: "Problema" },
          { value: "reminder", label: "Recordatorio" },
        ]}
      />

      {/* Preserve the current view so changing filters doesn't drop you back
          to the default grouped view. */}
      {current.view && <input type="hidden" name="view" value={current.view} />}
      <input type="hidden" name="limit" value={PAGE_SIZE} />

      <div className="ml-auto flex items-center gap-2">
        {hasFilters && (
          <Link href="/notifications" className="text-sm text-neutral-600 hover:text-neutral-900">
            Limpiar
          </Link>
        )}
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 h-9 rounded-md px-4 text-sm font-medium text-white transition"
        >
          Aplicar
        </button>
      </div>
    </form>
  );
}

type Option = string | { value: string; label: string };

function FilterSelect({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue: string | undefined;
  options: Option[];
}) {
  const isSelected = !!defaultValue && defaultValue !== "";
  return (
    <div className="relative">
      <select
        id={id}
        name={id}
        defaultValue={defaultValue ?? ""}
        className={`${inputCls} appearance-none pr-8 ${isSelected ? "border-brand-600 bg-brand-50/50 text-brand-700 font-medium" : ""}`}
      >
        <option value="">{label}</option>
        {options.map((opt) => {
          const value = typeof opt === "string" ? opt : opt.value;
          const optLabel = typeof opt === "string" ? opt : opt.label;
          return (
            <option key={value} value={value}>
              {optLabel}
            </option>
          );
        })}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-2.5 h-3 w-3 -translate-y-1/2 text-neutral-400"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
