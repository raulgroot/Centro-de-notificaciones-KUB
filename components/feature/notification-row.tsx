import Link from "next/link";
import type { NotificationRecord } from "@/lib/ports/notification-source";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

export function NotificationRow({ n }: { n: NotificationRecord }) {
  return (
    <Link
      href={`/notifications/${n.id}`}
      className="grid grid-cols-12 gap-4 border-b border-neutral-100 px-4 py-3 text-sm transition hover:bg-neutral-50"
    >
      <div className="col-span-5 min-w-0">
        <div className="truncate font-medium text-neutral-900">{n.subject || "—"}</div>
        <div className="truncate text-xs text-neutral-500">{n.themeName}</div>
      </div>
      <div className="col-span-2 flex flex-wrap content-center gap-1">
        {n.products.map((p) => (
          <Badge key={p}>{p}</Badge>
        ))}
      </div>
      <div className="col-span-2 flex items-center gap-1.5 text-xs text-neutral-600">
        {n.isDebit && <Badge tone="amber">débito</Badge>}
        {n.isEmployee && <Badge tone="violet">empleado</Badge>}
        {!n.hasTheme && <Badge tone="red">sin theme</Badge>}
      </div>
      <div className="col-span-2 flex items-center text-xs text-neutral-500">
        {n.updatedAt ? dateFmt.format(n.updatedAt) : "—"}
      </div>
      <div className="col-span-1 flex items-center justify-end text-xs text-neutral-400">→</div>
    </Link>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "amber" | "violet" | "red";
}) {
  const tones = {
    neutral: "bg-neutral-100 text-neutral-700",
    amber: "bg-amber-100 text-amber-800",
    violet: "bg-violet-100 text-violet-800",
    red: "bg-red-100 text-red-800",
  } as const;
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium tracking-wide uppercase ${tones[tone]}`}
    >
      {children}
    </span>
  );
}
