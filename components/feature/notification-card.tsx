import Link from "next/link";
import Image from "next/image";
import {
  Mail,
  ArrowUpRight,
  Eye,
  Truck,
  CheckCircle2,
  AlertTriangle,
  PowerCircle,
  Bell,
  CreditCard,
} from "lucide-react";
import type { NotificationRecord } from "@/lib/ports/notification-source";
import { computeStatus, STATUS_STYLES } from "@/lib/core/notifications/status";
import { toDate, toIso } from "@/lib/core/notifications/dates";
import {
  extractLifecycleStage,
  STAGE_LABEL,
  STAGE_STYLES,
  type LifecycleStage,
} from "@/lib/core/notifications/lifecycle";
import { cardIconFor } from "@/lib/core/notifications/card-icon";

const STAGE_ICON: Record<LifecycleStage, typeof Mail> = {
  emitted: CreditCard,
  transit: Truck,
  delivered: CheckCircle2,
  problem: AlertTriangle,
  activation: PowerCircle,
  reminder: Bell,
};

const dateFmt = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

/**
 * Acepta `Date | string | null` porque desde unstable_cache los Date
 * llegan como ISO string (ver lib/core/notifications/dates.ts).
 */
function relativeDate(value: Date | string | null): string {
  const d = toDate(value);
  if (!d) return "—";
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(diff) < 1) return "hoy";
  if (Math.abs(diff) < 30) return dateFmt.format(Math.round(diff), "day");
  if (Math.abs(diff) < 365) return dateFmt.format(Math.round(diff / 30), "month");
  return dateFmt.format(Math.round(diff / 365), "year");
}

/**
 * Visual card for the grid / grouped views. Click anywhere → detail page.
 * The "Preview" button in the footer is a separate <a> with target=_blank
 * that opens the Kublau template preview link directly, skipping the detail
 * page. We use the stretched-link pattern (Link's ::before pseudo-element
 * covers the whole card; the preview button sits on a higher z-index) so we
 * don't need client-side onClick handlers to intercept event bubbling.
 */
export function NotificationCard({ n }: { n: NotificationRecord }) {
  const status = computeStatus(n.lastSentAt);
  const styles = STATUS_STYLES[status.status];
  const stage = extractLifecycleStage(n.themeName);
  const cardIcon = cardIconFor(n.products);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition focus-within:ring-2 focus-within:ring-neutral-900 focus-within:ring-offset-1 hover:-translate-y-0.5 hover:shadow-md">
      {/* Visual stripe. If the notification has a known HSBC card product
          (viva, advance, premier, …) we show the real card art. Otherwise
          we fall back to a stage-specific icon (Truck for transit,
          CheckCircle2 for delivered, etc.) so the card still has visual
          identity. Background tint always comes from liveness status. */}
      <div
        className={`relative flex h-[96px] items-center justify-center overflow-hidden border-b ${styles.border} ${styles.bg}`}
      >
        {cardIcon ? (
          <Image
            src={cardIcon}
            alt={n.products[0] ?? "Tarjeta HSBC"}
            width={130}
            height={84}
            className="h-[72px] w-auto object-contain drop-shadow-sm"
            unoptimized
          />
        ) : (
          (() => {
            const Icon = stage ? STAGE_ICON[stage] : Mail;
            return <Icon className={`h-10 w-10 ${styles.text} opacity-40`} />;
          })()
        )}
        <span
          className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border ${styles.border} bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur ${styles.text}`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${styles.dot}`} />
          {status.label}
        </span>
        <ArrowUpRight className="absolute right-3 bottom-2 h-3.5 w-3.5 text-neutral-400 opacity-0 transition group-hover:opacity-100" />
      </div>

      {/* Body. Link uses ::before to cover the whole card so click anywhere
          opens the detail page. */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <Link
          href={`/notifications/${n.id}`}
          className="before:absolute before:inset-0 before:z-[1] before:rounded-xl before:content-['']"
          aria-label={n.subject || n.themeName || "Detalle"}
        >
          <h3 className="line-clamp-2 text-sm leading-snug font-semibold text-neutral-900">
            {n.subject || "—"}
          </h3>
        </Link>
        <p className="line-clamp-1 text-[11px] text-neutral-500" title={n.themeName}>
          {n.themeName}
        </p>

        {stage && (
          <div className="mt-0.5">
            <StageChip stage={stage} />
          </div>
        )}

        {(n.isDebit || n.isEmployee || !n.hasTheme) && (
          <div className="flex flex-wrap gap-1">
            {n.isDebit && <Flag tone="amber">débito</Flag>}
            {n.isEmployee && <Flag tone="violet">empleado</Flag>}
            {!n.hasTheme && <Flag tone="red">sin theme</Flag>}
          </div>
        )}

        <div className="mt-1 flex flex-wrap gap-1">
          {n.products.slice(0, 2).map((p) => (
            <Tag key={`p-${p}`} kind="product">
              {p}
            </Tag>
          ))}
          {n.movements.slice(0, 1).map((m) => (
            <Tag key={`m-${m}`} kind="movement">
              {m}
            </Tag>
          ))}
          {(n.products.length > 2 || n.movements.length > 1) && (
            <span className="text-[10px] text-neutral-400">
              +{n.products.length - 2 + (n.movements.length - 1)}
            </span>
          )}
        </div>
      </div>

      {/* Footer. Higher z-index than the stretched link so the Preview
          button captures clicks instead of navigating to the detail page.
          The "Última enviada" link lives in the detail page (Enlaces a
          Kublau section), not here — to keep the card listing breezy. */}
      <div className="relative z-[2] flex items-center justify-between gap-2 border-t border-neutral-100 px-3.5 py-2 text-[11px] text-neutral-500">
        <span title={toIso(n.lastSentAt) ?? "Nunca enviada"}>
          {n.lastSentAt ? `Enviada ${relativeDate(n.lastSentAt)}` : "Sin enviar"}
        </span>
        {n.templatePreviewLink && (
          <a
            href={n.templatePreviewLink}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-neutral-200 bg-white px-2 py-1 text-[11px] font-medium text-neutral-700 transition hover:border-neutral-300 hover:bg-neutral-50 hover:text-neutral-900"
            title="Abrir preview del template en Kublau"
          >
            <Eye className="h-3 w-3" />
            Preview
          </a>
        )}
      </div>
    </div>
  );
}

function Tag({ children, kind }: { children: React.ReactNode; kind: "product" | "movement" }) {
  const styles = {
    product: "bg-neutral-100 text-neutral-700",
    movement: "bg-blue-50 text-blue-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${styles[kind]}`}
    >
      {children}
    </span>
  );
}

function StageChip({ stage }: { stage: LifecycleStage }) {
  const s = STAGE_STYLES[stage];
  const Icon = STAGE_ICON[stage];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${s.bg} ${s.text} ${s.border}`}
      title={`Etapa: ${STAGE_LABEL[stage]}`}
    >
      <Icon className="h-3 w-3" />
      {STAGE_LABEL[stage]}
    </span>
  );
}

function Flag({ children, tone }: { children: React.ReactNode; tone: "amber" | "violet" | "red" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-700",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
