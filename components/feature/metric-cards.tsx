import type { MetricsSummary } from "@/lib/ports/metrics-source";

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
    },
    {
      label: "Abiertos",
      value: numberFmt.format(summary.totalOpened),
      hint: `Open rate: ${pctFmt.format(summary.avgOpenRate)}`,
    },
    {
      label: "Clics",
      value: numberFmt.format(summary.totalClicked),
      hint: `Click rate: ${pctFmt.format(summary.avgClickRate)}`,
    },
    {
      label: "RSR",
      value: numberFmt.format(summary.totalRsr),
      hint: `${pctFmt.format(summary.totalSent ? summary.totalRsr / summary.totalSent : 0)} de envíos`,
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-md border border-neutral-200 bg-white p-4">
          <div className="text-xs font-medium tracking-wider text-neutral-500 uppercase">
            {c.label}
          </div>
          <div className="mt-1 text-2xl font-bold tracking-tight">{c.value}</div>
          <div className="mt-1 text-xs text-neutral-500">{c.hint}</div>
        </div>
      ))}
    </div>
  );
}
