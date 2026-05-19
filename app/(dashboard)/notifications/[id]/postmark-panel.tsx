/**
 * Postmark verification panel — async RSC.
 *
 * Dado un `subject` y un `lastSentAt` de Kublau, busca en Postmark mensajes
 * que coincidan, calcula el estado de verificación, y renderiza:
 *   - Badge con el status (verificado / desactualizado / sin match)
 *   - Conteo de envíos en los últimos 30 días
 *   - Último envío real (fecha + recipient enmascarado)
 *   - Tabla con los últimos 5 envíos
 *
 * Si Postmark falla (API caída, key inválida, rate-limit), el panel se
 * degrada a un mensaje de error en vez de tirar la página completa. Es
 * info complementaria — no bloquea la vista del catálogo.
 */

import { CheckCircle2, AlertCircle, XCircle, Circle } from "lucide-react";
import { listOutboundMessages } from "@/lib/adapters/postmark/client";
import {
  classifyVerification,
  VERIFICATION_LABELS,
  type VerificationStatus,
} from "@/lib/notifications/postmark-link";

const POSTMARK_LOOKBACK_DAYS = 30;

const dtFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
});

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Mask "raul.robles@gmail.com" → "ra***@gmail.com" so el panel no expone PII. */
function maskEmail(email: string | undefined): string {
  if (!email) return "—";
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return email;
  const head = local.slice(0, 2);
  return `${head}${"*".repeat(Math.max(0, local.length - 2))}@${domain}`;
}

export async function PostmarkPanel({
  subject,
  kublauLastSentAt,
}: {
  subject: string;
  kublauLastSentAt: Date | null;
}) {
  if (!subject?.trim()) {
    return (
      <SectionCard>
        <SectionTitle />
        <EmptyState reason="Esta notificación no tiene subject en el catálogo, no podemos buscar en Postmark." />
      </SectionCard>
    );
  }

  // RSC runs once per request — calling Date.now here is request-scoped, not
  // render-scoped. The purity lint is meant for client components that
  // re-render; safe to disable in an async server component.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  const fromDate = new Date(now - POSTMARK_LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const toDate = new Date(now);

  let result: Awaited<ReturnType<typeof listOutboundMessages>> | null = null;
  let error: string | null = null;
  try {
    result = await listOutboundMessages({
      subject,
      fromDate: isoDate(fromDate),
      toDate: isoDate(toDate),
      count: 10,
    });
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  if (error) {
    return (
      <SectionCard>
        <SectionTitle />
        <div className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700">
          No se pudo consultar Postmark: {error}
        </div>
      </SectionCard>
    );
  }

  const messages = result?.messages ?? [];
  const totalCount = result?.totalCount ?? 0;
  const postmarkLastSentAt = messages[0]?.receivedAt ?? null;
  const status = classifyVerification({
    kublauLastSentAt,
    postmarkLastSentAt,
  });

  return (
    <SectionCard>
      <SectionTitle status={status} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Metric label="Envíos (30 días)" value={totalCount.toLocaleString("en-US")} />
        <Metric
          label="Último envío Postmark"
          value={postmarkLastSentAt ? dtFmt.format(postmarkLastSentAt) : "—"}
        />
        <Metric
          label="Último envío Kublau"
          value={kublauLastSentAt ? dtFmt.format(kublauLastSentAt) : "—"}
        />
      </div>

      <p className="mt-3 text-xs text-neutral-500">{VERIFICATION_LABELS[status].hint}</p>

      {messages.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Últimos envíos en Postmark
          </div>
          <div className="mt-2 overflow-hidden rounded-md border border-neutral-200">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 text-neutral-500">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Fecha</th>
                  <th className="px-3 py-2 text-left font-medium">Destinatario</th>
                  <th className="px-3 py-2 text-left font-medium">Status</th>
                  <th className="px-3 py-2 text-left font-medium">Tracking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {messages.slice(0, 5).map((m) => (
                  <tr key={m.messageId}>
                    <td className="px-3 py-2 text-neutral-700">{dtFmt.format(m.receivedAt)}</td>
                    <td className="px-3 py-2 font-mono text-[11px] text-neutral-600">
                      {maskEmail(m.to[0]?.email)}
                    </td>
                    <td className="px-3 py-2">
                      <StatusPill status={m.status} />
                    </td>
                    <td className="px-3 py-2 text-neutral-500">
                      {m.trackOpens ? "opens" : "—"}
                      {m.trackLinks !== "None" ? " · clicks" : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalCount > 5 && (
            <p className="mt-2 text-[11px] text-neutral-500">
              Mostrando 5 de {totalCount.toLocaleString("en-US")} envíos en los últimos{" "}
              {POSTMARK_LOOKBACK_DAYS} días.
            </p>
          )}
        </div>
      )}

      {messages.length === 0 && (
        <div className="mt-4 rounded-md bg-neutral-50 px-3 py-2 text-xs text-neutral-600">
          Postmark no encontró envíos con este subject en los últimos {POSTMARK_LOOKBACK_DAYS} días.
        </div>
      )}
    </SectionCard>
  );
}

/* ─────────────────── tiny presentational helpers ─────────────────── */

function SectionCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-lg border border-neutral-200 bg-white p-5">{children}</div>
  );
}

function SectionTitle({ status }: { status?: VerificationStatus }) {
  const meta = status ? VERIFICATION_LABELS[status] : null;
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        Postmark · Verificación de envíos
      </div>
      {meta && (
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            meta.tone === "ok"
              ? "bg-emerald-50 text-emerald-700"
              : meta.tone === "warn"
                ? "bg-amber-50 text-amber-700"
                : meta.tone === "bad"
                  ? "bg-rose-50 text-rose-700"
                  : "bg-neutral-100 text-neutral-600"
          }`}
        >
          {meta.tone === "ok" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {meta.tone === "warn" && <AlertCircle className="h-3.5 w-3.5" />}
          {meta.tone === "bad" && <XCircle className="h-3.5 w-3.5" />}
          {meta.tone === "muted" && <Circle className="h-3.5 w-3.5" />}
          {meta.label}
        </span>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/60 px-3 py-2.5">
      <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold text-neutral-900">{value}</div>
    </div>
  );
}

function EmptyState({ reason }: { reason: string }) {
  return <p className="text-xs text-neutral-500">{reason}</p>;
}

function StatusPill({ status }: { status: string }) {
  const ok = status === "Sent" || status === "Delivered";
  const bad = status === "Bounced" || status === "SpamComplaint";
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${
        ok
          ? "bg-emerald-50 text-emerald-700"
          : bad
            ? "bg-rose-50 text-rose-700"
            : "bg-neutral-100 text-neutral-700"
      }`}
    >
      {status}
    </span>
  );
}

/** Skeleton shown by Suspense while Postmark fetch runs. */
export function PostmarkPanelSkeleton() {
  return (
    <SectionCard>
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          Postmark · Verificación de envíos
        </div>
        <div className="h-5 w-24 animate-pulse rounded-full bg-neutral-100" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-md bg-neutral-100" />
        ))}
      </div>
      <div className="h-32 animate-pulse rounded-md bg-neutral-100" />
    </SectionCard>
  );
}
