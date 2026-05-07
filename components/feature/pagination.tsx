import Link from "next/link";

interface PaginationProps {
  total: number;
  limit: number;
  offset: number;
  baseQuery: Record<string, string | undefined>;
}

export function Pagination({ total, limit, offset, baseQuery }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const currentPage = Math.floor(offset / limit) + 1;
  const prevOffset = Math.max(0, offset - limit);
  const nextOffset = offset + limit;
  const hasPrev = offset > 0;
  const hasNext = nextOffset < total;

  const buildHref = (newOffset: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(baseQuery)) {
      if (v != null && v !== "") sp.set(k, v);
    }
    if (newOffset > 0) sp.set("offset", String(newOffset));
    const qs = sp.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  };

  const btn = "rounded-md border px-3 py-1.5 text-sm font-medium transition";
  const enabled = "border-neutral-300 text-neutral-700 hover:bg-neutral-100";
  const disabled = "border-neutral-200 text-neutral-300";

  return (
    <nav className="flex items-center justify-between border-t border-neutral-100 px-5 py-3 text-sm">
      <span className="text-neutral-500">
        Página <span className="font-semibold text-neutral-700">{currentPage}</span> de {totalPages}{" "}
        · {total.toLocaleString("es-MX")} notificación{total === 1 ? "" : "es"}
      </span>
      <div className="flex gap-2">
        {hasPrev ? (
          <Link href={buildHref(prevOffset)} className={`${btn} ${enabled}`}>
            ← Anterior
          </Link>
        ) : (
          <span className={`${btn} ${disabled}`}>← Anterior</span>
        )}
        {hasNext ? (
          <Link href={buildHref(nextOffset)} className={`${btn} ${enabled}`}>
            Siguiente →
          </Link>
        ) : (
          <span className={`${btn} ${disabled}`}>Siguiente →</span>
        )}
      </div>
    </nav>
  );
}
