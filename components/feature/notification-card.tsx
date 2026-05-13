import Link from "next/link";
import { Mail, ArrowUpRight } from "lucide-react";
import type { NotificationRecord } from "@/lib/ports/notification-source";
import { computeStatus, STATUS_STYLES } from "@/lib/core/notifications/status";

const dateFmt = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

function relativeDate(d: Date | null): string {
  if (!d) return "—";
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(diff) < 1) return "hoy";
  if (Math.abs(diff) < 30) return dateFmt.format(Math.round(diff), "day");
  if (Math.abs(diff) < 365) return dateFmt.format(Math.round(diff / 30), "month");
  return dateFmt.format(Math.round(diff / 365), "year");
}

/**
 * Visual card for the grid / grouped views. Heavier than the row but readable
 * at a glance: brand stripe on top tinted by status, subject + theme front
 * and center, badges, tags, and last-sent in the footer. No iframe — the
 * stripe + envelope icon serve as the visual hook without paying the 200-
 * iframe perf cost.
 */
export function NotificationCard({ n }: { n: NotificationRecord }) {
  const status = computeStatus(n.lastSentAt);
  const styles = STATUS_STYLES[status.status];

  return (
    <Link
      href={`/notifications/${n.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Status stripe + preview area */}
      <div
        className={`relative flex h-[88px] items-center justify-center overflow-hidden border-b ${styles.border} ${styles.bg}`}
      >
        <Mail className={`h-9 w-9 ${styles.text} opacity-40`} />
        <span
          className={`absolute top-2 right-2 inline-flex items-center gap-1 rounded-full border ${styles.border} bg-white/80 px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase backdrop-blur ${styles.text}`}
        >
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${styles.dot}`} />
          {status.label}
        </span>
        <ArrowUpRight className="absolute right-3 bottom-2 h-3.5 w-3.5 text-neutral-400 opacity-0 transition group-hover:opacity-100" />
      </div>

      {/* Body */}
      <div className="flex flex-1 flex-col gap-1.5 p-3.5">
        <div className="flex items-start gap-1.5">
          <h3 className="line-clamp-2 flex-1 text-sm leading-snug font-semibold text-neutral-900">
            {n.subject || "—"}
          </h3>
        </div>
        <p className="line-clamp-1 text-[11px] text-neutral-500" title={n.themeName}>
          {n.themeName}
        </p>

        {/* Flags */}
        {(n.isDebit || n.isEmployee || !n.hasTheme) && (
          <div className="flex flex-wrap gap-1">
            {n.isDebit && <Flag tone="amber">débito</Flag>}
            {n.isEmployee && <Flag tone="violet">empleado</Flag>}
            {!n.hasTheme && <Flag tone="red">sin theme</Flag>}
          </div>
        )}

        {/* Tags */}
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

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-neutral-100 px-3.5 py-2 text-[11px] text-neutral-500">
        <span title={n.lastSentAt?.toISOString() ?? "Nunca enviada"}>
          {n.lastSentAt ? `Enviada ${relativeDate(n.lastSentAt)}` : "Sin enviar"}
        </span>
        <span title={n.updatedAt?.toISOString() ?? ""}>Edit. {relativeDate(n.updatedAt)}</span>
      </div>
    </Link>
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
