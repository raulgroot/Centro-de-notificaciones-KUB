import { QAClient } from "./qa-client";

export const dynamic = "force-dynamic";

export default function QAPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">QA</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Indica la fecha en que subiste cambios y sube la lista de themes. Te digo cuáles ya se
          mandaron después de esa fecha (listos para revisar) y cuáles siguen pendientes de salir.
        </p>
      </header>
      <QAClient />
    </div>
  );
}
