import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseNotificationSource as notifs } from "@/lib/adapters/supabase/notification-source";
import { ArrowLeft, ExternalLink, Eye } from "lucide-react";
import { PostmarkPanel, PostmarkPanelSkeleton } from "./postmark-panel";
import { LastPieceCard } from "./last-piece-card";
import { sanitizeForPreview } from "@/lib/notifications/sanitize-preview";

/** Masca "raul.robles@gmail.com" → "ra***@gmail.com" para el banner de envío. */
function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
}

// El detalle tiene metadata estática (1×/día) + panel de Postmark live
// (que ya hace su propia fetch dentro de Suspense, fuera del cache de
// page). Con revalidate=30 la metadata se cachea pero Postmark sigue
// trayendo data fresca.
export const revalidate = 30;

const dateFmt = new Intl.DateTimeFormat("es-MX", { dateStyle: "long" });

type Params = Promise<{ id: string }>;

export default async function NotificationDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const n = await notifs.getById(id);
  if (!n) notFound();

  const previewLink = n.templatePreviewLink ?? n.templateLink;

  return (
    <div className="space-y-6">
      <Link
        href="/notifications"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver
      </Link>

      <header className="flex items-start justify-between gap-4 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
            {n.subject || "(sin asunto)"}
          </h1>
          <p className="mt-1 text-sm text-neutral-600">{n.themeName}</p>
        </div>
        {previewLink && (
          <a
            href={previewLink}
            target="_blank"
            rel="noreferrer noopener"
            className="bg-brand-600 hover:bg-brand-700 inline-flex shrink-0 items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-white transition"
          >
            <Eye className="h-4 w-4" />
            Ver preview en Kublau
          </a>
        )}
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card>
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Identificación
          </div>
          <DetailField label="ID">
            <code className="font-mono text-xs break-all">{n.id}</code>
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
        </Card>

        <Card>
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Configuración
          </div>
          <DetailField label="Flags">
            <div className="flex flex-wrap gap-1.5">
              {n.isDebit && <Pill tone="amber">débito</Pill>}
              {n.isEmployee && <Pill tone="violet">empleado</Pill>}
              {n.hasTheme ? (
                <Pill tone="emerald">con theme</Pill>
              ) : (
                <Pill tone="red">sin theme</Pill>
              )}
              {!n.isDebit && !n.isEmployee && n.hasTheme && (
                <span className="text-sm text-neutral-400">—</span>
              )}
            </div>
          </DetailField>
          <DetailField label="Hora de envío">
            <span className="text-sm">{n.sendTime ?? "—"}</span>
          </DetailField>
          <DetailField label="Última actualización">
            <span className="text-sm">{n.updatedAt ? dateFmt.format(n.updatedAt) : "—"}</span>
          </DetailField>
        </Card>

        <Card>
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Mensajería
          </div>
          <DetailField label="Asunto del correo">
            <p className="text-sm text-neutral-800">{n.subject || "—"}</p>
          </DetailField>
          <DetailField label="Texto SMS">
            {n.smsText ? (
              <p className="rounded-md bg-neutral-50 p-2.5 text-xs text-neutral-700">{n.smsText}</p>
            ) : (
              <span className="text-sm text-neutral-400">Sin texto SMS</span>
            )}
          </DetailField>
        </Card>
      </div>

      {/* Postmark verification — streams in via Suspense so the rest of the
          page paints instantly even if Postmark is slow / rate-limited. */}
      <Suspense fallback={<PostmarkPanelSkeleton />}>
        <PostmarkPanel subject={n.subject} kublauLastSentAt={n.lastSentAt} />
      </Suspense>

      {/* Última pieza real — gated detrás de un confirm modal. El HTML va
          sanitizado server-side (hrefs removidos, forms neutralizados,
          tracking pixels reemplazados) ANTES de bajar al cliente. */}
      {n.htmlBody && (
        <LastPieceCard
          sanitizedHtml={sanitizeForPreview(n.htmlBody)}
          lastSentAt={n.lastSentAt}
          recipientMasked={maskEmail(n.lastMailTo)}
        />
      )}

      {(n.themeLink || n.templateLink || n.templatePreviewLink || n.postmarkUrl) && (
        <Card>
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Enlaces a Kublau
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {n.themeLink && <ExternalLinkRow href={n.themeLink} label="Theme / trigger" />}
            {n.templateLink && n.templateLink !== n.themeLink && (
              <ExternalLinkRow href={n.templateLink} label="Editar template" />
            )}
            {n.templatePreviewLink && (
              <ExternalLinkRow href={n.templatePreviewLink} label="Preview del template" />
            )}
            {n.postmarkUrl && (
              <ExternalLinkRow href={n.postmarkUrl} label="Ver última notificación enviada" />
            )}
          </div>
        </Card>
      )}
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
