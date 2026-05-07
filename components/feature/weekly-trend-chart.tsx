"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface WeeklyRow {
  weekLabel: string;
  counts: Record<string, number>;
  total: number;
}

const PALETTE = [
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
  "#f97316",
] as const;

export function WeeklyTrendChart({
  rows,
  topN = 6,
  title,
}: {
  rows: WeeklyRow[];
  topN?: number;
  title: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">
        Sin datos
      </div>
    );
  }

  // Pick top N keys by total volume across all weeks.
  const totals: Record<string, number> = {};
  for (const r of rows) {
    for (const [k, v] of Object.entries(r.counts)) {
      totals[k] = (totals[k] ?? 0) + v;
    }
  }
  const topKeys = Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, topN)
    .filter(([, v]) => v > 0)
    .map(([k]) => k);

  const data = rows.map((r) => {
    const row: Record<string, string | number> = { week: r.weekLabel };
    for (const k of topKeys) row[k] = r.counts[k] ?? 0;
    return row;
  });

  return (
    <div className="rounded-md border border-neutral-200 bg-white p-4">
      <h3 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h3>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
            <XAxis dataKey="week" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            {topKeys.map((k, i) => (
              <Line
                key={k}
                type="monotone"
                dataKey={k}
                stroke={PALETTE[i % PALETTE.length]}
                strokeWidth={2}
                dot={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
