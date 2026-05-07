import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { NotificationRecord } from "@/lib/ports/notification-source";

const dateFmt = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

const relativeDate = (d: Date | null): string => {
  if (!d) return "—";
  const diff = (d.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (Math.abs(diff) < 1) return "hoy";
  if (Math.abs(diff) < 30) return dateFmt.format(Math.round(diff), "day");
  if (Math.abs(diff) < 365) return dateFmt.format(Math.round(diff / 30), "month");
  return dateFmt.format(Math.round(diff / 365), "year");
};

export function NotificationRow({ n }: { n: NotificationRecord }) {
  const tags = [
    ...n.products.slice(0, 2).map((v) => ({ kind: "product" as const, value: v })),
    ...n.movements.slice(0, 1).map((v) => ({ kind: "movement" as const, value: v })),
  ];

  return (
    <Link
      href={`/notifications/${n.id}`}
      className="hover:bg-brand-50/30 grid grid-cols-12 items-center gap-4 border-b border-neutral-100 px-5 py-3.5 text-sm transition last:border-b-0"
    >
      <div className="col-span-6 min-w-0">
        <div className="flex items-center gap-2">
          <div className="truncate font-medium text-neutral-900">{n.subject || "—"}</div>
          {n.isDebit && <Pill tone="amber">débito</Pill>}
          {n.isEmployee && <Pill tone="violet">empleado</Pill>}
          {!n.hasTheme && <Pill tone="red">sin theme</Pill>}
        </div>
        <div className="mt-0.5 truncate text-xs text-neutral-500">{n.themeName}</div>
      </div>

      <div className="col-span-4 flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <Tag key={`${t.kind}-${t.value}`} kind={t.kind}>
            {t.value}
          </Tag>
        ))}
        {(n.products.length > 2 || n.movements.length > 1) && (
          <span className="text-[10px] text-neutral-400">
            +{n.products.length - 2 + (n.movements.length - 1)}
          </span>
        )}
      </div>

      <div className="col-span-1 text-right text-xs text-neutral-500">
        {relativeDate(n.updatedAt)}
      </div>
      <div className="col-span-1 flex justify-end">
        <ChevronRight className="h-4 w-4 text-neutral-300" />
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
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${styles[kind]}`}
    >
      {children}
    </span>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone: "amber" | "violet" | "red" }) {
  const tones = {
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
    red: "bg-red-50 text-red-700",
  } as const;
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
