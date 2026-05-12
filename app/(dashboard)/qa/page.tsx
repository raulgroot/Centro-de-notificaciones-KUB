import { QAClient } from "./qa-client";

export const dynamic = "force-dynamic";

export default function QAPage() {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">QA</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Sube una hoja con los nombres de los themes y la fecha de tu cambio. Te muestro el último
          envío real de cada uno para que valides que el cambio ya salió.
        </p>
      </header>
      <QAClient />
    </div>
  );
}
