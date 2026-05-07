import Link from "next/link";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  /** Current searchParams without `offset` (we'll add it). */
  baseQuery: Record<string, string | undefined>;
}

export function Pagination({ total, limit, offset, baseQuery }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;

  const buildHref = (newOffset: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseQuery)) {
      if (v != null && v !== "") sp.set(k, v);
    }
    if (newOffset > 0) sp.set("offset", String(newOffset));
    const qs = sp.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };

  return (
    <nav className="flex items-center justify-between border-t border-neutral-100 px-4 py-3 text-sm">
      <span className="text-neutral-500">
        Página {currentPage} de {totalPages} · {total} notificación{total === 1 ? "" : "es"}
      </span>
      <div className="flex gap-2">
        {offset > 0 ? (
          <Link
            href={buildHref(prevOffset)}
            className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
          >
            ← Anterior
          </Link>
        ) : (
          <span className="rounded-md border border-neutral-200 px-3 py-1 text-neutral-300">
            ← Anterior
          </span>
        )}
        {nextOffset < total ? (
          <Link
            href={buildHref(nextOffset)}
            className="rounded-md border border-neutral-300 px-3 py-1 hover:bg-neutral-100"
          >
            Siguiente →
          </Link>
        ) : (
          <span className="rounded-md border border-neutral-200 px-3 py-1 text-neutral-300">
            Siguiente →
          </span>
        )}
      </div>
    </nav>
  );
}
