import Link from "next/link";
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

/**
 * Search + filter form. Plain HTML form that GETs to the same page,
 * so the server reads the filters from `searchParams` — no client JS required.
 */
export function NotificationFilters({ facets, current }: FiltersProps) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-md border border-neutral-200 bg-white p-4"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="search" className="text-xs font-medium text-neutral-600">
          Buscar
        </label>
        <input
          id="search"
          name="search"
          type="search"
          defaultValue={current.search ?? ""}
          placeholder="Asunto o nombre del theme…"
          className="w-72 rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
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

      <FilterSelect id="debit" label="Débito" defaultValue={current.debit} options={["SI", "NO"]} />
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

      <input type="hidden" name="limit" value={PAGE_SIZE} />

      <div className="ml-auto flex gap-2">
        <button
          type="submit"
          className="rounded-md bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-neutral-700"
        >
          Aplicar
        </button>
        <Link
          href="/notifications"
          className="rounded-md border border-neutral-300 px-4 py-1.5 text-sm hover:bg-neutral-100"
        >
          Limpiar
        </Link>
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
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-medium text-neutral-600">
        {label}
      </label>
      <select
        id={id}
        name={id}
        defaultValue={defaultValue ?? ""}
        className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm focus:border-neutral-900 focus:outline-none"
      >
        <option value="">— Todos —</option>
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    </div>
  );
}
