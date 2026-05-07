export default function NotificationsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Lista, búsqueda y filtros de las notificaciones de Kublau.
        </p>
      </header>
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-500">
        Pendiente: conectar con Kublau ClickHouse y mapear tablas.{" "}
        <code className="rounded bg-neutral-200 px-1.5 py-0.5 text-xs">pnpm kublau:tables</code>
      </div>
    </div>
  );
}
