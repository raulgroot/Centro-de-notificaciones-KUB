/**
 * Visual replica of the legacy "campaign card" — load date header, próxima
 * notificación tile, progress bar, and timeline dots. Server-rendered;
 * dates are formatted with `Intl` so we don't ship locale logic to the client.
 */

import type { CampaignDefinition } from "@/lib/adapters/supabase/campaigns";
import type { CampaignTimelineView, MilestoneState } from "@/lib/core/campaigns/timeline";
import { ExternalLink } from "lucide-react";
import { CardActionsMenu } from "@/app/(dashboard)/campanas/card-actions-menu";

const monthsShort = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];
const monthsFull = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const fmtShort = (d: Date): string => `${d.getDate()} ${monthsShort[d.getMonth()]}`;
const fmtFull = (d: Date): string => `${d.getDate()} de ${monthsFull[d.getMonth()]}`;

export function CampaignCard({
  definition,
  view,
}: {
  definition: CampaignDefinition;
  view: CampaignTimelineView;
}) {
  const { load, elapsedDays, ended, progressPercent, timeline, next, daysToDeadline } = view;
  const accent = definition.accentColor;
  const accentBg = `${accent}1A`; // ~10% alpha
  const totalDays = view.totalDays;
  const endDate = new Date(load.loadDate.getTime() + totalDays * 86_400_000);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      {/* Header: pill + carga info + asana link */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium"
            style={{ background: accentBg, color: accent }}
          >
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: accent }}
              aria-hidden
            />
            {definition.name}
          </div>
          {load.title && (
            <div className="mt-2 truncate font-mono text-xs text-neutral-700" title={load.title}>
              {load.title}
            </div>
          )}
        </div>
        <div className="flex items-start gap-1">
          <div className="text-right text-xs text-neutral-500">
            <div>
              Carga: <strong className="text-neutral-800">{fmtFull(load.loadDate)}</strong> · día{" "}
              <strong className="text-neutral-800">{elapsedDays}</strong>
              {ended && <span className="ml-1 text-neutral-400">(completada)</span>}
            </div>
            {load.asanaUrl && (
              <a
                href={load.asanaUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-[#F06A6A] hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                Ver en Asana
              </a>
            )}
          </div>
          <CardActionsMenu loadId={load.id} status={load.status} />
        </div>
      </div>

      {/* Próxima notificación */}
      <div className="mt-4 rounded-lg border border-dashed border-neutral-300 bg-neutral-50/60 p-4">
        {next ? (
          <>
            <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Próxima notificación
            </div>
            <div className="mt-1 text-xl font-semibold text-neutral-900">
              {next.milestone.label}
            </div>
            <div className="mt-1 flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-semibold" style={{ color: accent }}>
                {next.milestone.dayOffset !== null && next.milestone.dayOffset - elapsedDays === 1
                  ? "En 1 día"
                  : next.milestone.dayOffset !== null
                    ? `En ${next.milestone.dayOffset - elapsedDays} días`
                    : "Pendiente"}
              </span>
              <span className="text-neutral-400">·</span>
              <span className="text-neutral-700">{fmtShort(next.date)}</span>
            </div>
            {next.milestone.description && (
              <div className="mt-1 text-xs text-neutral-500">{next.milestone.description}</div>
            )}
          </>
        ) : (
          <>
            <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
              Estado
            </div>
            <div className="mt-1 text-lg font-semibold text-neutral-900">
              Ciclo completado · todas las notificaciones enviadas
            </div>
          </>
        )}
      </div>

      {/* Deadline */}
      {load.deadline && daysToDeadline !== null && (
        <div
          className={`mt-3 flex items-center justify-between rounded-md border px-3 py-2 text-xs ${
            daysToDeadline <= 0
              ? "border-neutral-300 bg-neutral-50 text-neutral-600"
              : daysToDeadline <= 5
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
          }`}
        >
          <span className="font-medium">
            {daysToDeadline <= 0 ? "Campaña cerrada" : `Fecha límite en ${daysToDeadline} días`}
          </span>
          <span>{fmtShort(load.deadline)}</span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-5">
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${progressPercent}%`, background: accent }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] text-neutral-500">
          <span>{fmtShort(load.loadDate)}</span>
          <span>{fmtShort(endDate)}</span>
        </div>
      </div>

      {/* Timeline dots */}
      <div className="mt-4 flex items-start justify-between">
        {timeline.map((p, i) => (
          <TimelineDot
            key={p.milestone.id}
            date={fmtShort(p.date)}
            state={p.state}
            accent={accent}
            withConnector={i < timeline.length - 1}
            label={p.milestone.label}
            description={p.milestone.description}
          />
        ))}
      </div>

      {/* Conditional / event-based milestones */}
      {view.conditional.length > 0 && (
        <div className="mt-5 border-t border-neutral-100 pt-4">
          <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
            Disparadores fuera del timeline
          </div>
          <ul className="mt-2 space-y-1">
            {view.conditional.map((m) => (
              <li key={m.id} className="flex items-start gap-2 text-xs text-neutral-700">
                <span
                  className="mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: accent, opacity: 0.6 }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{m.label}</span>
                  <span className="text-neutral-500"> · {m.description}</span>
                </div>
                <span className="shrink-0 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] font-medium tracking-wider text-neutral-600 uppercase">
                  {m.triggerType === "event" ? "evento" : "manual"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Notes */}
      {load.notes && (
        <div className="mt-4 rounded-md bg-neutral-50 p-3 text-xs text-neutral-600">
          {load.notes}
        </div>
      )}
    </div>
  );
}

function TimelineDot({
  date,
  state,
  accent,
  withConnector,
  label,
  description,
}: {
  date: string;
  state: MilestoneState;
  accent: string;
  withConnector: boolean;
  label: string;
  description: string;
}) {
  const fill =
    state === "done"
      ? accent
      : state === "current"
        ? "transparent"
        : state === "next"
          ? "transparent"
          : "transparent";

  const ring =
    state === "current"
      ? `0 0 0 3px ${accent}33`
      : state === "next"
        ? `inset 0 0 0 2px ${accent}`
        : state === "done"
          ? "none"
          : `inset 0 0 0 1.5px #d4d4d4`;

  const dotStyle: React.CSSProperties = {
    background: fill,
    boxShadow: ring,
    border: state === "done" ? `2px solid ${accent}` : "none",
    borderStyle: state === "future" ? "dashed" : undefined,
  };

  return (
    <div className="relative flex flex-1 flex-col items-center" title={`${label} — ${description}`}>
      <div className="h-3.5 w-3.5 rounded-full transition" style={dotStyle} />
      <div className="mt-1.5 text-[11px] font-medium text-neutral-700">{date}</div>
      {withConnector && (
        <div
          className="absolute top-[7px] right-[calc(-50%+12px)] left-[calc(50%+12px)] h-px"
          style={{ background: state === "done" ? accent : "#e5e5e5" }}
          aria-hidden
        />
      )}
    </div>
  );
}
