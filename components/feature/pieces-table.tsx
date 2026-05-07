import type { PieceMetrics } from "@/lib/ports/metrics-source";

const numberFmt = new Intl.NumberFormat("es-MX");
const pctFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  maximumFractionDigits: 1,
});

const cleanPieceName = (s: string): string => {
  const idx = s.indexOf("|");
  return idx >= 0 ? s.slice(idx + 1).trim() : s.trim();
};

export function PiecesTable({ pieces }: { pieces: PieceMetrics[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-neutral-200 bg-white">
      <header className="grid grid-cols-12 gap-4 border-b border-neutral-200 bg-neutral-50/60 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        <div className="col-span-5">Pieza</div>
        <div className="col-span-1">Producto</div>
        <div className="col-span-1 text-right">Enviado</div>
        <div className="col-span-1 text-right">Abierto</div>
        <div className="col-span-1 text-right">Click</div>
        <div className="col-span-1 text-right">Open rate</div>
        <div className="col-span-1 text-right">Click rate</div>
        <div className="col-span-1 text-right">RSR</div>
      </header>

      {pieces.length === 0 ? (
        <div className="p-16 text-center text-sm text-neutral-500">Sin datos.</div>
      ) : (
        pieces.map((p, i) => (
          <div
            key={`${p.piece}-${p.product}-${i}`}
            className="grid grid-cols-12 items-center gap-4 border-b border-neutral-100 px-5 py-3 text-sm last:border-b-0 hover:bg-neutral-50/60"
          >
            <div
              className="col-span-5 min-w-0 truncate font-medium text-neutral-900"
              title={p.piece}
            >
              {cleanPieceName(p.piece)}
            </div>
            <div className="col-span-1 min-w-0 truncate text-xs text-neutral-600">{p.product}</div>
            <div className="col-span-1 text-right text-neutral-700 tabular-nums">
              {numberFmt.format(p.sent)}
            </div>
            <div className="col-span-1 text-right text-neutral-700 tabular-nums">
              {numberFmt.format(p.opened)}
            </div>
            <div className="col-span-1 text-right text-neutral-700 tabular-nums">
              {numberFmt.format(p.clicked)}
            </div>
            <div className="col-span-1 text-right font-medium text-emerald-700 tabular-nums">
              {pctFmt.format(p.openRate)}
            </div>
            <div className="text-brand-600 col-span-1 text-right font-medium tabular-nums">
              {pctFmt.format(p.clickRate)}
            </div>
            <div className="col-span-1 text-right text-neutral-700 tabular-nums">
              {numberFmt.format(p.rsr)}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
