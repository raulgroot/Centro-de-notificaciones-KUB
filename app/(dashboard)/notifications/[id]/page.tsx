import { notFound } from "next/navigation";
import Link from "next/link";
import { kublauNotificationSource } from "@/lib/adapters/clickhouse-kublau/notification-source";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });

type Params = Promise<{ id: string }>;

export default async function NotificationDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const n = await kublauNotificationSource.getById(id);
  if (!n) notFound();

  return (
    <div className="space-y-6">
      <Link href="/notifications" className="text-sm text-neutral-600 hover:underline">
        ← Volver a la lista
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{n.subject || "(sin asunto)"}</h1>
        <p className="text-sm text-neutral-600">{n.themeName}</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-4 space-y-4 text-sm">
          <DetailField label="ID">
            <code className="font-mono text-xs">{n.id}</code>
          </DetailField>

          <DetailField label="Productos">
            <Tags values={n.products} />
          </DetailField>

          <DetailField label="Movimientos">
            <Tags values={n.movements} />
          </DetailField>

          <DetailField label="Tipos de cliente">
            <Tags values={n.clientTypes} />
          </DetailField>

          <DetailField label="Flags">
            <div className="flex flex-wrap gap-1.5 text-xs">
              {n.isDebit && (
                <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-800">débito</span>
              )}
              {n.isEmployee && (
                <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-800">empleado</span>
              )}
              {n.hasTheme ? (
                <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-800">
                  con theme
                </span>
              ) : (
                <span className="rounded bg-red-100 px-2 py-0.5 text-red-800">sin theme</span>
              )}
            </div>
          </DetailField>

          <DetailField label="SMS">
            {n.smsText ? (
              <p className="rounded-md bg-neutral-50 p-2 text-xs text-neutral-700">{n.smsText}</p>
            ) : (
              <span className="text-neutral-400">— sin texto SMS —</span>
            )}
          </DetailField>

          <DetailField label="Última actualización (Kublau)">
            {n.updatedAt ? dateFmt.format(n.updatedAt) : "—"}
          </DetailField>

          <DetailField label="Último envío">
            {n.lastSentAt ? dateFmt.format(n.lastSentAt) : "—"}
          </DetailField>

          <DetailField label="Último destinatario">
            {n.lastMailTo ? (
              <code className="text-xs">{n.lastMailTo}</code>
            ) : (
              <span className="text-neutral-400">—</span>
            )}
          </DetailField>

          <DetailField label="Enlaces">
            <div className="flex flex-col gap-1.5">
              {n.themeLink && (
                <ExternalLinkRow href={n.themeLink} label="Ver theme/trigger en Kublau" />
              )}
              {n.templateLink && n.templateLink !== n.themeLink && (
                <ExternalLinkRow href={n.templateLink} label="Ver template en Kublau" />
              )}
              {n.postmarkUrl && <ExternalLinkRow href={n.postmarkUrl} label="Ver en Postmark" />}
            </div>
          </DetailField>
        </aside>

        <section className="col-span-8">
          <h2 className="mb-2 text-sm font-semibold tracking-wider text-neutral-500 uppercase">
            Preview HTML del último mail
          </h2>
          {n.htmlBody ? (
            <iframe
              srcDoc={n.htmlBody}
              title="Preview"
              sandbox=""
              className="h-[800px] w-full rounded-md border border-neutral-200 bg-white"
            />
          ) : (
            <div className="rounded-md border border-dashed border-neutral-300 p-12 text-center text-sm text-neutral-500">
              Esta notificación todavía no tiene un envío registrado con HTML.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium tracking-wider text-neutral-500 uppercase">{label}</div>
      <div className="mt-1">{children}</div>
    </div>
  );
}

function Tags({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-neutral-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-700"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
    >
      <ExternalLink className="h-3 w-3" />
      {label}
    </a>
  );
}
