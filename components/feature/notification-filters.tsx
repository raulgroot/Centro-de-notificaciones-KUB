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
  };
}

const inputCls =
  "h-9 rounded-md border border-neutral-300 bg-white px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20 focus:outline-none";

export function NotificationFilters({ facets, current }: FiltersProps) {
  const hasFilters = Object.values(current).some((v) => v && v !== "");

  return (
    <form method="get" className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative lg:col-span-2">
          <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400" />
          <input
            id="search"
            name="search"
            type="search"
            defaultValue={current.search ?? ""}
            placeholder="Buscar por asunto o nombre del theme…"
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
          label="Tipo de cliente"
          defaultValue={current.clientType}
          options={facets.clientTypes}
        />
        <FilterSelect
          id="debit"
          label="Débito"
          defaultValue={current.debit}
          options={["SI", "NO"]}
        />
        <FilterSelect
          id="employee"
          label="Empleado"
          defaultValue={current.employee}
          options={["SI", "NO"]}
        />
        <FilterSelect
          id="hasTheme"
          label="Con theme"
          defaultValue={current.hasTheme}
          options={["SI", "NO"]}
        />
      </div>

      <input type="hidden" name="limit" value={PAGE_SIZE} />

      <div className="mt-4 flex items-center justify-end gap-2 border-t border-neutral-100 pt-4">
        {hasFilters && (
          <Link
            href="/notifications"
            className="rounded-md px-3 py-1.5 text-sm text-neutral-600 hover:bg-neutral-100"
          >
            Limpiar
          </Link>
        )}
        <button
          type="submit"
          className="bg-brand-600 hover:bg-brand-700 rounded-md px-4 py-1.5 text-sm font-medium text-white transition"
        >
          Aplicar
        </button>
      </div>
    </form>
  );
}

function FilterSelect({
  id,
  label,
  defaultValue,
  options,
}: {
  id: string;
  label: string;
  defaultValue: string | undefined;
  options: string[];
}) {
  return (
    <div className="relative">
      <select
        id={id}
        name={id}
        defaultValue={defaultValue ?? ""}
        className={`${inputCls} w-full appearance-none pr-8`}
      >
        <option value="">{label} — todos</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
      <svg
        className="pointer-events-none absolute top-1/2 right-3 h-3 w-3 -translate-y-1/2 text-neutral-400"
        viewBox="0 0 12 12"
        fill="none"
      >
        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
