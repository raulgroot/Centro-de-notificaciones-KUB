export default function FlowsPage() {
  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Flujos</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Vista de presentación de los journeys de notificaciones.
        </p>
      </header>
      <div className="rounded-md border border-dashed border-neutral-300 bg-neutral-50 p-8 text-sm text-neutral-500">
        Pendiente: definir estructura de flujos en `lib/db/schema.ts → flows` y construir vista.
      </div>
    </div>
  );
}
