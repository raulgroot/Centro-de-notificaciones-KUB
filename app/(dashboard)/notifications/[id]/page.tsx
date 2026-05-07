type Params = Promise<{ id: string }>;

export default async function NotificationDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Notificación {id}</h1>
      <p className="text-sm text-neutral-600">
        Vista detalle — pendiente de implementar tras mapear el esquema de Kublau.
      </p>
    </div>
  );
}
