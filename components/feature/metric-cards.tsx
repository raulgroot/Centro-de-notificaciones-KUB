import type { MetricsSummary } from "@/lib/ports/metrics-source";
import { Mail, MailOpen, MousePointerClick, Send } from "lucide-react";

const numberFmt = new Intl.NumberFormat("es-MX");
const pctFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  maximumFractionDigits: 1,
});

export function MetricCards({ summary }: { summary: MetricsSummary }) {
  const cards = [
    {
      label: "Enviados",
      value: numberFmt.format(summary.totalSent),
      hint: `${numberFmt.format(summary.pieceCount)} piezas`,
      icon: Send,
    },
    {
      label: "Abiertos",
      value: numberFmt.format(summary.totalOpened),
      hint: `Open rate: ${pctFmt.format(summary.avgOpenRate)}`,
      icon: MailOpen,
    },
    {
      label: "Clics",
      value: numberFmt.format(summary.totalClicked),
      hint: `Click rate: ${pctFmt.format(summary.avgClickRate)}`,
      icon: MousePointerClick,
    },
    {
      label: "RSR",
      value: numberFmt.format(summary.totalRsr),
      hint: `${pctFmt.format(summary.totalSent ? summary.totalRsr / summary.totalSent : 0)} de envíos`,
      icon: Mail,
    },
  ] as const;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ label, value, hint, icon: Icon }) => (
        <div key={label} className="rounded-lg border border-neutral-200 bg-white p-5">
          <div className="flex items-start justify-between">
            <div className="text-xs font-medium tracking-wider text-neutral-500 uppercase">
              {label}
            </div>
            <div className="bg-brand-50 text-brand-600 flex h-7 w-7 items-center justify-center rounded-md">
              <Icon className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight text-neutral-900">{value}</div>
          <div className="mt-1 text-xs text-neutral-500">{hint}</div>
        </div>
      ))}
    </div>
  );
}
