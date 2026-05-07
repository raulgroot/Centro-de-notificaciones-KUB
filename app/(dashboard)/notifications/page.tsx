import { kublauNotificationSource } from "@/lib/adapters/clickhouse-kublau/notification-source";
import { NotificationFilters } from "@/components/feature/notification-filters";
import { NotificationRow } from "@/components/feature/notification-row";
import { Pagination } from "@/components/feature/pagination";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const yesNoToBool = (v: string | undefined): boolean | undefined =>
  v === "SI" ? true : v === "NO" ? false : undefined;

const single = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = single(params.search);
  const product = single(params.product);
  const movement = single(params.movement);
  const clientType = single(params.clientType);
  const debit = single(params.debit);
  const employee = single(params.employee);
  const hasTheme = single(params.hasTheme);
  const offset = Math.max(0, Number(single(params.offset) ?? 0));

  const filter = {
    search,
    product,
    movement,
    clientType,
    isDebit: yesNoToBool(debit),
    isEmployee: yesNoToBool(employee),
    hasTheme: yesNoToBool(hasTheme),
    limit: PAGE_SIZE,
    offset,
  };

  const [notifications, total, facets] = await Promise.all([
    kublauNotificationSource.list(filter),
    kublauNotificationSource.count(filter),
    kublauNotificationSource.facets(),
  ]);

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Notificaciones</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {total.toLocaleString("es-MX")} notificaciones · fuente: Kublau
          </p>
        </div>
      </header>

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <NotificationFilters
          facets={facets}
          current={{ search, product, movement, clientType, debit, employee, hasTheme }}
        />

        <header className="grid grid-cols-12 gap-4 border-b border-neutral-200 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          <div className="col-span-6">Asunto / Theme</div>
          <div className="col-span-4">Etiquetas</div>
          <div className="col-span-1 text-right">Actualizada</div>
          <div className="col-span-1" />
        </header>

        {notifications.length === 0 ? (
          <div className="p-16 text-center text-sm text-neutral-500">
            Sin resultados. Prueba ajustando los filtros.
          </div>
        ) : (
          notifications.map((n) => <NotificationRow key={n.id} n={n} />)
        )}

        <Pagination
          total={total}
          limit={PAGE_SIZE}
          offset={offset}
          baseQuery={{ search, product, movement, clientType, debit, employee, hasTheme }}
        />
      </section>
    </div>
  );
}
