/**
 * Loading skeleton global del dashboard. Aparece mientras Next pinta el
 * primer chunk después de un nav. Mata el ciclo "pantalla blanca → user
 * cree que se rompió → click otra vez → 2 requests concurrentes → race".
 *
 * Diseño genérico (header + 3 cards + tabla) que funciona para todas
 * las pantallas del dashboard.
 */

export default function DashboardLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="flex items-end justify-between gap-4 border-b border-neutral-200 pb-6">
        <div className="space-y-2">
          <div className="h-7 w-64 rounded bg-neutral-200" />
          <div className="h-4 w-48 rounded bg-neutral-100" />
        </div>
        <div className="h-9 w-32 rounded bg-neutral-200" />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
            <div className="h-3 w-24 rounded bg-neutral-100" />
            <div className="h-6 w-32 rounded bg-neutral-200" />
            <div className="h-3 w-40 rounded bg-neutral-100" />
          </div>
        ))}
      </div>

      <div className="space-y-3 rounded-lg border border-neutral-200 bg-white p-5">
        <div className="h-4 w-1/3 rounded bg-neutral-200" />
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded bg-neutral-100" />
          ))}
        </div>
      </div>
    </div>
  );
}
