import { unstable_cache } from "next/cache";
import { supabaseNotificationSource as notifs } from "@/lib/adapters/supabase/notification-source";
import { NotificationFilters } from "@/components/feature/notification-filters";
import { NotificationRow } from "@/components/feature/notification-row";
import { NotificationCard } from "@/components/feature/notification-card";
import { MovementGroup } from "@/components/feature/movement-group";
import {
  NotificationViewToggle,
  type NotificationView,
} from "@/components/feature/notification-view-toggle";
import { Pagination } from "@/components/feature/pagination";
import { filterByStatus, groupByMovement } from "@/lib/core/notifications/grouping";
import type { NotificationStatus } from "@/lib/core/notifications/status";

export const dynamic = "force-dynamic";

const getCachedFacets = unstable_cache(() => notifs.facets(), ["notification-facets-v2"], {
  revalidate: 300,
  tags: ["facets"],
});

const PAGE_SIZE = 50;
const CARDS_PAGE_SIZE = 48;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const yesNoToBool = (v: string | undefined): boolean | undefined =>
  v === "SI" ? true : v === "NO" ? false : undefined;

const single = (v: string | string[] | undefined): string | undefined =>
  Array.isArray(v) ? v[0] : v;

const STATUS_VALUES: NotificationStatus[] = ["active", "inactive", "zombie", "never"];
const parseStatus = (v: string | undefined): NotificationStatus | undefined =>
  v && (STATUS_VALUES as string[]).includes(v) ? (v as NotificationStatus) : undefined;

const parseView = (v: string | undefined): NotificationView =>
  v === "cards" || v === "list" ? v : "groups";

export default async function NotificationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const search = single(params.search);
  const product = single(params.product);
  const movement = single(params.movement);
  const clientType = single(params.clientType);
  const debit = single(params.debit);
  const employee = single(params.employee);
  const hasTheme = single(params.hasTheme);
  const status = parseStatus(single(params.status));
  const view = parseView(single(params.view));
  const offset = Math.max(0, Number(single(params.offset) ?? 0));

  const baseFilter = {
    search,
    product,
    movement,
    clientType,
    isDebit: yesNoToBool(debit),
    isEmployee: yesNoToBool(employee),
    hasTheme: yesNoToBool(hasTheme),
  };

  const facets = await getCachedFacets();
  const currentParams: Record<string, string | undefined> = {
    search,
    product,
    movement,
    clientType,
    debit,
    employee,
    hasTheme,
    status,
    view: view === "groups" ? undefined : view,
  };

  return (
    <div className="space-y-6">
      <Header view={view} currentParams={currentParams} />

      <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <NotificationFilters
          facets={facets}
          current={{
            search,
            product,
            movement,
            clientType,
            debit,
            employee,
            hasTheme,
            status,
            view: view === "groups" ? undefined : view,
          }}
        />

        {view === "list" ? (
          <ListView
            filter={{ ...baseFilter, limit: PAGE_SIZE, offset }}
            status={status}
            offset={offset}
            currentParams={currentParams}
          />
        ) : view === "cards" ? (
          <CardsView
            filter={{ ...baseFilter, limit: CARDS_PAGE_SIZE, offset }}
            status={status}
            offset={offset}
            currentParams={currentParams}
          />
        ) : (
          <GroupsView filter={baseFilter} status={status} />
        )}
      </section>
    </div>
  );
}

function Header({
  view,
  currentParams,
}: {
  view: NotificationView;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">Notificaciones</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Catálogo HSBC · agrupado por journey, con estado de actividad
        </p>
      </div>
      <NotificationViewToggle current={view} currentParams={currentParams} />
    </header>
  );
}

/* ─────────────────────── List view (current behavior) ─────────────────────── */

async function ListView({
  filter,
  status,
  offset,
  currentParams,
}: {
  filter: Parameters<typeof notifs.list>[0];
  status: NotificationStatus | undefined;
  offset: number;
  currentParams: Record<string, string | undefined>;
}) {
  // When a status filter is active we have to fetch all (post-filtering at
  // the app layer since lastSentAt windows aren't a simple column predicate)
  // and slice. Without status the regular DB-side pagination is fine.
  if (status) {
    const all = filterByStatus(await notifs.listAllLight(filter), status);
    const window = all.slice(offset, offset + (filter.limit ?? PAGE_SIZE));
    return (
      <ListBody
        notifications={window}
        total={all.length}
        offset={offset}
        currentParams={currentParams}
      />
    );
  }
  const [notifications, total] = await Promise.all([notifs.list(filter), notifs.count(filter)]);
  return (
    <ListBody
      notifications={notifications}
      total={total}
      offset={offset}
      currentParams={currentParams}
    />
  );
}

function ListBody({
  notifications,
  total,
  offset,
  currentParams,
}: {
  notifications: Awaited<ReturnType<typeof notifs.list>>;
  total: number;
  offset: number;
  currentParams: Record<string, string | undefined>;
}) {
  return (
    <>
      <header className="flex items-center justify-between border-b border-neutral-200 px-5 py-2.5">
        <div className="grid flex-1 grid-cols-12 gap-4 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          <div className="col-span-6">Asunto / Theme</div>
          <div className="col-span-4">Etiquetas</div>
          <div className="col-span-1 text-right">Actualizada</div>
          <div className="col-span-1" />
        </div>
        <span className="ml-3 shrink-0 text-xs text-neutral-500">
          {total.toLocaleString("es-MX")} en total
        </span>
      </header>

      {notifications.length === 0 ? (
        <Empty />
      ) : (
        notifications.map((n) => <NotificationRow key={n.id} n={n} />)
      )}

      <Pagination total={total} limit={PAGE_SIZE} offset={offset} baseQuery={currentParams} />
    </>
  );
}

/* ─────────────────────── Cards view (flat grid) ─────────────────────── */

async function CardsView({
  filter,
  status,
  offset,
  currentParams,
}: {
  filter: Parameters<typeof notifs.list>[0];
  status: NotificationStatus | undefined;
  offset: number;
  currentParams: Record<string, string | undefined>;
}) {
  let items: Awaited<ReturnType<typeof notifs.list>>;
  let total: number;
  if (status) {
    const all = filterByStatus(await notifs.listAllLight(filter), status);
    total = all.length;
    items = all.slice(offset, offset + (filter.limit ?? CARDS_PAGE_SIZE));
  } else {
    [items, total] = await Promise.all([notifs.list(filter), notifs.count(filter)]);
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-2.5 text-xs">
        <span className="font-medium text-neutral-700">
          {total.toLocaleString("es-MX")} notificaciones
        </span>
      </div>
      {items.length === 0 ? (
        <Empty />
      ) : (
        <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((n) => (
            <NotificationCard key={n.id} n={n} />
          ))}
        </div>
      )}
      <Pagination total={total} limit={CARDS_PAGE_SIZE} offset={offset} baseQuery={currentParams} />
    </>
  );
}

/* ─────────────────────── Groups view (default) ─────────────────────── */

async function GroupsView({
  filter,
  status,
}: {
  filter: Parameters<typeof notifs.list>[0];
  status: NotificationStatus | undefined;
}) {
  const all = filterByStatus(await notifs.listAllLight(filter), status);
  const groups = groupByMovement(all);

  if (all.length === 0) {
    return (
      <>
        <div className="border-b border-neutral-200 px-5 py-2.5 text-xs text-neutral-500">
          0 notificaciones
        </div>
        <Empty />
      </>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between border-b border-neutral-200 px-5 py-2.5 text-xs">
        <span className="font-medium text-neutral-700">
          {all.length.toLocaleString("es-MX")} notificaciones · {groups.length} grupos
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4">
        {groups.map((g) => (
          <MovementGroup
            key={g.movement}
            movement={g.movement}
            items={g.items}
            summary={g.summary}
            subgroups={g.subgroups}
          />
        ))}
      </div>
    </>
  );
}

function Empty() {
  return (
    <div className="p-16 text-center text-sm text-neutral-500">
      Sin resultados. Prueba ajustando los filtros.
    </div>
  );
}
