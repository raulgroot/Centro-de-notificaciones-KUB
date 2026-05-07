import Link from "next/link";
import { ChevronRight } from "lucide-react";
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
      className="grid grid-cols-12 items-center gap-4 border-b border-neutral-100 px-5 py-3.5 text-sm transition last:border-b-0 hover:bg-neutral-50"
    >
      <div className="col-span-5 min-w-0">
        <div className="truncate font-medium text-neutral-900">{n.subject || "—"}</div>
        <div className="mt-0.5 truncate text-xs text-neutral-500">{n.themeName}</div>
      </div>
      <div className="col-span-2 flex flex-wrap content-center gap-1">
        {n.products.slice(0, 3).map((p) => (
          <Badge key={p}>{p}</Badge>
        ))}
        {n.products.length > 3 && (
          <span className="text-[10px] text-neutral-500">+{n.products.length - 3}</span>
        )}
      </div>
      <div className="col-span-2 flex items-center gap-1.5">
        {n.isDebit && <Badge tone="amber">débito</Badge>}
        {n.isEmployee && <Badge tone="violet">empleado</Badge>}
        {!n.hasTheme && <Badge tone="red">sin theme</Badge>}
      </div>
      <div className="col-span-2 flex items-center text-xs text-neutral-500">
        {n.updatedAt ? dateFmt.format(n.updatedAt) : "—"}
      </div>
      <div className="col-span-1 flex items-center justify-end">
        <ChevronRight className="h-4 w-4 text-neutral-300" />
      </div>
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
