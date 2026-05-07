import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseNotificationSource as notifs } from "@/lib/adapters/supabase/notification-source";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long", timeStyle: "short" });

type Params = Promise<{ id: string }>;

export default async function NotificationDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const n = await notifs.getById(id);
  if (!n) notFound();

  return (
    <div className="space-y-6">
      <Link
        href="/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <header className="border-b border-neutral-200 pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
          {n.subject || "(sin asunto)"}
        </h1>
        <p className="mt-1 text-sm text-neutral-600">{n.themeName}</p>
      </header>

      <div className="grid grid-cols-12 gap-6">
        <aside className="col-span-12 space-y-5 lg:col-span-4">
          <Card>
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
              <div className="flex flex-wrap gap-1.5">
                {n.isDebit && <Pill tone="amber">débito</Pill>}
                {n.isEmployee && <Pill tone="violet">empleado</Pill>}
                {n.hasTheme ? (
                  <Pill tone="emerald">con theme</Pill>
                ) : (
                  <Pill tone="red">sin theme</Pill>
                )}
              </div>
            </DetailField>
          </Card>

          <Card>
            <DetailField label="SMS">
              {n.smsText ? (
                <p className="rounded-md bg-neutral-50 p-2.5 text-xs text-neutral-700">
                  {n.smsText}
                </p>
              ) : (
                <span className="text-sm text-neutral-400">Sin texto SMS</span>
              )}
            </DetailField>

            <DetailField label="Última actualización (Kublau)">
              <span className="text-sm">{n.updatedAt ? dateFmt.format(n.updatedAt) : "—"}</span>
            </DetailField>

            <DetailField label="Último envío">
              <span className="text-sm">{n.lastSentAt ? dateFmt.format(n.lastSentAt) : "—"}</span>
            </DetailField>

            <DetailField label="Último destinatario">
              {n.lastMailTo ? (
                <code className="text-xs">{n.lastMailTo}</code>
              ) : (
                <span className="text-sm text-neutral-400">—</span>
              )}
            </DetailField>
          </Card>

          {(n.themeLink || n.templateLink || n.postmarkUrl) && (
            <Card>
              <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                Enlaces
              </div>
              <div className="mt-3 flex flex-col gap-2">
                {n.themeLink && (
                  <ExternalLinkRow href={n.themeLink} label="Theme/trigger en Kublau" />
                )}
                {n.templateLink && n.templateLink !== n.themeLink && (
                  <ExternalLinkRow href={n.templateLink} label="Template en Kublau" />
                )}
                {n.postmarkUrl && <ExternalLinkRow href={n.postmarkUrl} label="Postmark" />}
              </div>
            </Card>
          )}
        </aside>

        <section className="col-span-12 lg:col-span-8">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
              Preview HTML del último mail
            </h2>
          </div>
          {n.htmlBody ? (
            <iframe
              srcDoc={n.htmlBody}
              title="Preview"
              sandbox=""
              className="h-[800px] w-full rounded-lg border border-neutral-200 bg-white"
            />
          ) : (
            <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-16 text-center text-sm text-neutral-500">
              Esta notificación todavía no tiene un envío registrado con HTML.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">{children}</div>
  );
}

function DetailField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function Tags({ values }: { values: string[] }) {
  if (values.length === 0) return <span className="text-sm text-neutral-400">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-xs font-medium text-neutral-700"
        >
          {v}
        </span>
      ))}
    </div>
  );
}

const PILL_TONES = {
  amber: "bg-amber-50 text-amber-700",
  violet: "bg-violet-50 text-violet-700",
  emerald: "bg-emerald-50 text-emerald-700",
  red: "bg-red-50 text-red-700",
} as const;

function Pill({ children, tone }: { children: React.ReactNode; tone: keyof typeof PILL_TONES }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${PILL_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

function ExternalLinkRow({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className="text-brand-600 inline-flex items-center gap-1.5 text-sm hover:underline"
    >
      <ExternalLink className="h-3.5 w-3.5" />
      {label}
    </a>
  );
}
