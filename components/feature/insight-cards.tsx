/**
 * Renders pre-digested insights from `lib/core/metrics/insights.ts`.
 *
 * Server Component. Each subcomponent is intentionally small so insights can
 * be re-arranged without touching the rest. Visual idiom: a feed of cards
 * grouped by section, no big charts (those live behind a "detalle" toggle).
 */

import type {
  AttentionInsights,
  ExecutiveSummary,
  MetricsInsights,
  OperationalHealth,
  QAQueueInsight,
  SubjectInsight,
  TopOpensInsight,
  VolumeAnomalyInsight,
  WeeklyDelta,
  WeeklyMomentum,
  WinnersInsights,
  ZombiesInsight,
} from "@/lib/core/metrics/insights";
import {
  AlertTriangle,
  Award,
  Crown,
  Eye,
  Flame,
  Ghost,
  HeartPulse,
  Lightbulb,
  ListChecks,
  MailQuestion,
  Snowflake,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react";

const numberFmt = new Intl.NumberFormat("es-MX");
const pctFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  maximumFractionDigits: 1,
});
const ppFmt = new Intl.NumberFormat("es-MX", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "always",
});

const cleanPieceName = (s: string): string => {
  const idx = s.indexOf("|");
  return idx >= 0 ? s.slice(idx + 1).trim() : s.trim();
};

// ─────────────────────────────────────────────────────────────────────────────
// Layout primitives

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <header>
        <h2 className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          {title}
        </h2>
        {description && <p className="mt-1 text-xs text-neutral-500">{description}</p>}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-lg border border-neutral-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function InsightHeader({
  Icon,
  iconColor,
  label,
}: {
  Icon: typeof TrendingUp;
  iconColor: string;
  label: string;
}) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <div
        className="flex h-7 w-7 items-center justify-center rounded-md"
        style={{ background: `${iconColor}1A`, color: iconColor }}
      >
        <Icon className="h-3.5 w-3.5" />
      </div>
      <span className="text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
        {label}
      </span>
    </div>
  );
}

function BigNumber({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-2xl font-bold tracking-tight text-neutral-900 tabular-nums">
      {children}
    </div>
  );
}

function Subtle({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 text-xs text-neutral-500">{children}</div>;
}

function DeltaBadge({ pct }: { pct: number }) {
  if (!Number.isFinite(pct)) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium text-emerald-700">
        nuevo
      </span>
    );
  }
  const positive = pct > 0;
  const negative = pct < 0;
  if (!positive && !negative) {
    return (
      <span className="inline-flex items-center gap-0.5 rounded bg-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-neutral-600">
        sin cambio
      </span>
    );
  }
  return (
    <span
      className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[11px] font-medium ${
        positive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
      }`}
    >
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {ppFmt.format(pct)}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Sections

function ExecutiveCard({ exec }: { exec: ExecutiveSummary }) {
  const verdict =
    exec.openRateHealth === "healthy"
      ? "saludable"
      : exec.openRateHealth === "average"
        ? "regular"
        : "bajo";
  const verdictColor =
    exec.openRateHealth === "healthy"
      ? "text-emerald-700"
      : exec.openRateHealth === "average"
        ? "text-amber-700"
        : "text-red-700";

  return (
    <Card>
      <p className="text-sm leading-relaxed text-neutral-800">
        En total se han enviado{" "}
        <strong className="text-neutral-900">{numberFmt.format(exec.totalSent)}</strong> correos a
        través de <strong className="text-neutral-900">{numberFmt.format(exec.pieceCount)}</strong>{" "}
        piezas. El <strong className="text-neutral-900">{pctFmt.format(exec.avgOpenRate)}</strong>{" "}
        los abre (<span className={`font-medium ${verdictColor}`}>{verdict}</span>) y el{" "}
        <strong className="text-neutral-900">{pctFmt.format(exec.avgClickRate)}</strong> hace click.
      </p>
    </Card>
  );
}

function WeeklySection({ weekly }: { weekly: WeeklyMomentum }) {
  if (!weekly.current) {
    return (
      <Card>
        <Subtle>Aún no hay datos semanales para comparar.</Subtle>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Card>
        <InsightHeader Icon={TrendingUp} iconColor="#2563eb" label="Esta semana" />
        <BigNumber>{numberFmt.format(weekly.current.total)}</BigNumber>
        <Subtle>
          correos enviados en {weekly.current.label}
          {weekly.totalDelta && (
            <span className="ml-2">
              <DeltaBadge pct={weekly.totalDelta.pct} />
            </span>
          )}
        </Subtle>
      </Card>

      <DeltaPairCard
        title="Producto que más creció"
        Icon={Flame}
        iconColor="#f97316"
        emptyText="Ningún producto subió esta semana."
        delta={weekly.topGrowingProduct}
        direction="up"
      />
      <DeltaPairCard
        title="Producto que más cayó"
        Icon={Snowflake}
        iconColor="#0891b2"
        emptyText="Ningún producto cayó esta semana."
        delta={weekly.topFallingProduct}
        direction="down"
      />
      <DeltaPairCard
        title="Movimiento que más creció"
        Icon={TrendingUp}
        iconColor="#16a34a"
        emptyText="Ningún movimiento subió esta semana."
        delta={weekly.topGrowingMovement}
        direction="up"
      />
      <DeltaPairCard
        title="Movimiento que más cayó"
        Icon={TrendingDown}
        iconColor="#dc2626"
        emptyText="Ningún movimiento cayó esta semana."
        delta={weekly.topFallingMovement}
        direction="down"
      />
    </div>
  );
}

function DeltaPairCard({
  title,
  Icon,
  iconColor,
  delta,
  emptyText,
  direction,
}: {
  title: string;
  Icon: typeof TrendingUp;
  iconColor: string;
  delta: WeeklyDelta | null;
  emptyText: string;
  direction: "up" | "down";
}) {
  return (
    <Card>
      <InsightHeader Icon={Icon} iconColor={iconColor} label={title} />
      {delta ? (
        <>
          <BigNumber>{delta.key}</BigNumber>
          <Subtle>
            {direction === "up" ? "+" : ""}
            {numberFmt.format(delta.delta)} envíos vs sem. anterior
            <span className="ml-2">
              <DeltaBadge pct={delta.pct} />
            </span>
          </Subtle>
        </>
      ) : (
        <Subtle>{emptyText}</Subtle>
      )}
    </Card>
  );
}

function WinnersSection({ winners }: { winners: WinnersInsights }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card>
        <InsightHeader Icon={Crown} iconColor="#ca8a04" label="Mejor pieza por open rate" />
        {winners.bestByOpenRate ? (
          <>
            <BigNumber>{pctFmt.format(winners.bestByOpenRate.openRate)}</BigNumber>
            <Subtle>
              <span className="font-medium text-neutral-700">
                {cleanPieceName(winners.bestByOpenRate.piece)}
              </span>{" "}
              · {winners.bestByOpenRate.product} · {numberFmt.format(winners.bestByOpenRate.sent)}{" "}
              envíos
            </Subtle>
          </>
        ) : (
          <Subtle>No hay piezas con suficiente volumen para comparar.</Subtle>
        )}
      </Card>

      <Card>
        <InsightHeader Icon={Award} iconColor="#0891b2" label="Mejor producto por engagement" />
        {winners.bestProductByOpenRate ? (
          <>
            <BigNumber>{winners.bestProductByOpenRate.product}</BigNumber>
            <Subtle>
              {pctFmt.format(winners.bestProductByOpenRate.openRate)} open rate ·{" "}
              {numberFmt.format(winners.bestProductByOpenRate.sent)} envíos
            </Subtle>
          </>
        ) : (
          <Subtle>No hay datos suficientes.</Subtle>
        )}
      </Card>

      <Card className="md:col-span-2">
        <InsightHeader Icon={Sparkles} iconColor="#7c3aed" label="Top 3 por click rate" />
        {winners.topByClickRate.length === 0 ? (
          <Subtle>No hay piezas con suficiente volumen para comparar.</Subtle>
        ) : (
          <ol className="mt-1 space-y-2">
            {winners.topByClickRate.map((p, i) => (
              <li key={`${p.piece}-${i}`} className="flex items-baseline gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-neutral-100 text-[11px] font-semibold text-neutral-700">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-neutral-800">
                  {cleanPieceName(p.piece)}
                </span>
                <span className="text-brand-600 font-semibold tabular-nums">
                  {pctFmt.format(p.clickRate)}
                </span>
                <span className="text-xs text-neutral-500 tabular-nums">
                  {numberFmt.format(p.sent)} envíos
                </span>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}

function AttentionSection({ attention }: { attention: AttentionInsights }) {
  const hasAny =
    attention.lowOpenRate.length > 0 ||
    attention.zeroOpens.length > 0 ||
    attention.outOfTimeRate > 0.05 ||
    attention.outOfTimeOffenders.length > 0;

  if (!hasAny) {
    return (
      <Card>
        <p className="text-sm text-neutral-700">
          ✓ No detecté piezas con problemas serios. Todo se ve bien.
        </p>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      {attention.lowOpenRate.length > 0 && (
        <Card>
          <InsightHeader Icon={AlertTriangle} iconColor="#dc2626" label="Open rate < 10%" />
          <p className="text-sm text-neutral-700">
            <strong>{attention.lowOpenRate.length}</strong>{" "}
            {attention.lowOpenRate.length === 1 ? "pieza" : "piezas"} con open rate bajo —
            probablemente contenido o asunto no convencen.
          </p>
          <ul className="mt-3 space-y-1.5">
            {attention.lowOpenRate.map((p) => (
              <li key={p.piece} className="flex items-baseline gap-3 text-xs" title={p.piece}>
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {cleanPieceName(p.piece)}
                </span>
                <span className="font-semibold text-red-700 tabular-nums">
                  {pctFmt.format(p.openRate)}
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {numberFmt.format(p.sent)} envíos
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {attention.zeroOpens.length > 0 && (
        <Card>
          <InsightHeader Icon={AlertTriangle} iconColor="#dc2626" label="Piezas con 0 opens" />
          <p className="text-sm text-neutral-700">
            <strong>{attention.zeroOpens.length}</strong>{" "}
            {attention.zeroOpens.length === 1 ? "pieza" : "piezas"} sin un solo open — destinatarios
            incorrectos, llegando a spam, o tracking roto.
          </p>
          <ul className="mt-3 space-y-1.5">
            {attention.zeroOpens.slice(0, 5).map((p) => (
              <li key={p.piece} className="flex items-baseline gap-3 text-xs" title={p.piece}>
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {cleanPieceName(p.piece)}
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {numberFmt.format(p.sent)} envíos
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {attention.outOfTimeRate > 0.05 && (
        <Card>
          <InsightHeader Icon={AlertTriangle} iconColor="#f59e0b" label="Clicks fuera de tiempo" />
          <BigNumber>{pctFmt.format(attention.outOfTimeRate)}</BigNumber>
          <Subtle>
            de los envíos generan clicks fuera del periodo válido (RSR). Indica posible UX confuso
            en algún CTA o usuarios que regresan al correo días después.
          </Subtle>
        </Card>
      )}

      {attention.outOfTimeOffenders.length > 0 && (
        <Card>
          <InsightHeader
            Icon={AlertTriangle}
            iconColor="#f59e0b"
            label="Peores piezas en clicks fuera de tiempo"
          />
          <ul className="space-y-1.5">
            {attention.outOfTimeOffenders.map((p, i) => (
              <li
                key={`${p.piece}-${i}`}
                className="flex items-baseline gap-3 text-xs"
                title={p.piece}
              >
                <span className="min-w-0 flex-1 truncate text-neutral-700">
                  {cleanPieceName(p.piece)}
                </span>
                <span className="font-semibold text-amber-700 tabular-nums">
                  {numberFmt.format(p.outOfTimeClicks)} fuera de tiempo
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function HealthSection({ health }: { health: OperationalHealth }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      <Card>
        <InsightHeader Icon={HeartPulse} iconColor="#0891b2" label="Última sincronización" />
        <BigNumber>{health.lastSyncedLabel}</BigNumber>
        {health.lastSyncedAt && <Subtle>{health.lastSyncedAt.toLocaleString("es-MX")}</Subtle>}
      </Card>
      <Card>
        <InsightHeader
          Icon={HeartPulse}
          iconColor="#16a34a"
          label="Templates modificados (7 días)"
        />
        <BigNumber>{numberFmt.format(health.templatesUpdatedLast7Days)}</BigNumber>
        <Subtle>
          {health.templatesUpdatedLast7Days === 0
            ? "Sin cambios recientes en los templates de Kublau."
            : "templates editados en Kublau en la última semana."}
        </Subtle>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// QA queue — what just got edited and needs reviewing

function QAQueueSection({ qa }: { qa: QAQueueInsight }) {
  return (
    <Card>
      <InsightHeader Icon={ListChecks} iconColor="#7c3aed" label="Cola de QA" />
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
          <div className="text-2xl font-bold text-amber-900 tabular-nums">
            {numberFmt.format(qa.pending.length)}
          </div>
          <div className="text-[11px] text-amber-700">Pendientes de envío</div>
        </div>
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3">
          <div className="text-2xl font-bold text-emerald-900 tabular-nums">
            {numberFmt.format(qa.readyForReview.length)}
          </div>
          <div className="text-[11px] text-emerald-700">Listos para QA</div>
        </div>
      </div>
      <Subtle>Templates editados en los últimos {qa.windowDays} días.</Subtle>
      {qa.pending.length > 0 && (
        <div className="mt-3">
          <div className="text-[11px] font-semibold tracking-wider text-amber-700 uppercase">
            Recién editados, sin enviar todavía
          </div>
          <ul className="mt-1.5 space-y-1">
            {qa.pending.slice(0, 6).map((q) => (
              <li key={q.themeName} className="truncate text-xs text-neutral-700">
                {q.themeName}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Templates zombi — lives at the bottom, less urgent but useful for cleanup

function ZombiesSection({ zombies }: { zombies: ZombiesInsight }) {
  return (
    <Card>
      <InsightHeader Icon={Ghost} iconColor="#6b7280" label="Templates zombi" />
      <BigNumber>{numberFmt.format(zombies.totalZombies)}</BigNumber>
      <Subtle>
        templates con tema activo que no se han enviado en {zombies.thresholdDays}+ días
        {zombies.neverSent > 0 && (
          <>
            {" "}
            · <strong>{zombies.neverSent}</strong> nunca han enviado
          </>
        )}
      </Subtle>
      {zombies.samples.length > 0 && (
        <ul className="mt-3 grid grid-cols-1 gap-1.5 md:grid-cols-2">
          {zombies.samples.slice(0, 10).map((z) => (
            <li key={z.themeName} className="flex items-baseline gap-3 text-xs" title={z.themeName}>
              <span className="min-w-0 flex-1 truncate text-neutral-700">{z.themeName}</span>
              <span className="font-semibold text-neutral-600 tabular-nums">
                {z.daysSinceLastSent} días
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Top 10 most-opened pieces — with heuristic "why" analysis

const cleanPieceLabel = (piece: string): string => {
  const [flight, descriptor] = piece.split("|").map((s) => s.trim());
  if (!descriptor) return flight ?? piece;
  return `${descriptor} · ${flight}`;
};

function TopOpensSection({ topOpens }: { topOpens: TopOpensInsight }) {
  if (topOpens.entries.length === 0) {
    return (
      <Card>
        <Subtle>Aún no hay piezas con opens suficientes para clasificar.</Subtle>
      </Card>
    );
  }
  return (
    <Card>
      <InsightHeader Icon={Eye} iconColor="#16a34a" label="Top 10 piezas más efectivas" />
      <p className="text-sm text-neutral-700">
        Ordenadas por <strong>open rate</strong> (mínimo 100 envíos). Para cada pieza muestro los{" "}
        <strong>subjects probables</strong> del catálogo y una hipótesis del por qué funcionan. Open
        rate promedio global: <strong>{pctFmt.format(topOpens.globalAvgOpenRate)}</strong>.
      </p>
      <ol className="mt-4 space-y-3">
        {topOpens.entries.map((e, i) => (
          <li
            key={`${e.piece}-${i}`}
            className="rounded-md border border-neutral-200 bg-neutral-50/60 p-3"
          >
            <div className="flex items-baseline gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-semibold text-emerald-700">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-neutral-900" title={e.piece}>
                  {cleanPieceLabel(e.piece)}
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-500">
                  <span className="font-medium">{e.product}</span> · {numberFmt.format(e.opened)}{" "}
                  opens de {numberFmt.format(e.sent)} envíos
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-base font-bold text-emerald-700 tabular-nums">
                  {pctFmt.format(e.openRate)}
                </div>
                {e.vsAverage >= 1.1 && (
                  <div className="text-[11px] text-emerald-600 tabular-nums">
                    {e.vsAverage.toFixed(1)}× promedio
                  </div>
                )}
              </div>
            </div>
            {e.candidateSubjects.length > 0 && (
              <div className="mt-2.5 pl-9">
                <div className="text-[10px] font-semibold tracking-wider text-neutral-500 uppercase">
                  Subjects probables
                </div>
                <ul className="mt-1 space-y-1">
                  {e.candidateSubjects.map((s, si) => (
                    <li
                      key={si}
                      className="border-l-2 border-emerald-300 pl-2 text-xs text-neutral-800"
                    >
                      “{s}”
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {e.candidateSubjects.length === 0 && (
              <div className="mt-2.5 pl-9">
                <div className="text-[10px] tracking-wider text-neutral-400 italic">
                  No encontré subjects con suficiente parecido al nombre de la pieza.
                </div>
              </div>
            )}
            {e.reasons.length > 0 && (
              <ul className="mt-2.5 space-y-1 pl-9">
                {e.reasons.map((r, ri) => (
                  <li key={ri} className="flex items-start gap-1.5 text-xs text-neutral-600">
                    <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
                    <span>{r}</span>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject patterns

function SubjectsSection({ subjects }: { subjects: SubjectInsight }) {
  const stats = [
    {
      label: "Longitud promedio",
      value: `${Math.round(subjects.avgLength)} chars`,
      hint: `mediana ${Math.round(subjects.medianLength)}`,
    },
    {
      label: "Con emoji",
      value: pctFmt.format(safePct(subjects.withEmojiCount, subjects.total)),
      hint: `${numberFmt.format(subjects.withEmojiCount)} templates`,
    },
    {
      label: "Con ¡! / !",
      value: pctFmt.format(safePct(subjects.withExclamationCount, subjects.total)),
      hint: `${numberFmt.format(subjects.withExclamationCount)} templates`,
    },
    {
      label: "Con ¿? / ?",
      value: pctFmt.format(safePct(subjects.withQuestionCount, subjects.total)),
      hint: `${numberFmt.format(subjects.withQuestionCount)} templates`,
    },
    {
      label: "Todo en MAYÚSCULAS",
      value: pctFmt.format(safePct(subjects.allCapsCount, subjects.total)),
      hint: `${numberFmt.format(subjects.allCapsCount)} templates`,
    },
    {
      label: "Sin subject",
      value: numberFmt.format(subjects.emptyCount),
      hint: subjects.emptyCount > 0 ? "revisar urgentemente" : "ninguno",
    },
  ];

  return (
    <div className="space-y-3">
      <Card>
        <InsightHeader Icon={Type} iconColor="#db2777" label="Patrones en los subjects" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
              <div className="text-[11px] font-medium tracking-wider text-neutral-500 uppercase">
                {s.label}
              </div>
              <div className="mt-1 text-lg font-bold text-neutral-900 tabular-nums">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500">{s.hint}</div>
            </div>
          ))}
        </div>
      </Card>
      {(subjects.longestSamples.length > 0 || subjects.shortestSamples.length > 0) && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <SubjectSamplesCard
            title="Subjects más largos"
            description="Posiblemente saturados — considera acortarlos."
            samples={subjects.longestSamples}
          />
          <SubjectSamplesCard
            title="Subjects más cortos"
            description="Útil para CTAs directos; si falta contexto puede bajar el open rate."
            samples={subjects.shortestSamples}
          />
        </div>
      )}
    </div>
  );
}

function SubjectSamplesCard({
  title,
  description,
  samples,
}: {
  title: string;
  description: string;
  samples: { themeName: string; subject: string; length: number }[];
}) {
  return (
    <Card>
      <InsightHeader Icon={MailQuestion} iconColor="#db2777" label={title} />
      <Subtle>{description}</Subtle>
      <ul className="mt-3 space-y-2">
        {samples.map((s) => (
          <li key={s.themeName} className="border-l-2 border-pink-200 pl-3 text-xs">
            <div className="font-medium text-neutral-900">{s.subject}</div>
            <div className="mt-0.5 truncate text-neutral-500">
              {s.themeName} · {s.length} chars
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Volume anomalies

function VolumeAnomaliesSection({ anomalies }: { anomalies: VolumeAnomalyInsight }) {
  const hasAny = anomalies.drops.length > 0 || anomalies.spikes.length > 0;
  if (!hasAny) {
    return (
      <Card>
        <Subtle>
          ✓ Sin anomalías de volumen significativas — todos los productos/movimientos se mantienen
          dentro de su rango habitual.
        </Subtle>
      </Card>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {anomalies.drops.length > 0 && (
        <Card>
          <InsightHeader
            Icon={TrendingDown}
            iconColor="#dc2626"
            label="Caídas drásticas (esta semana)"
          />
          <Subtle>Bajaron 30%+ vs su promedio de 4 semanas.</Subtle>
          <ul className="mt-3 space-y-2">
            {anomalies.drops.map((a) => (
              <li key={a.key} className="flex items-baseline gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
                  {a.key}
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {numberFmt.format(a.current)} vs ~{numberFmt.format(Math.round(a.baseline))}
                </span>
                <span className="font-semibold text-red-700 tabular-nums">
                  {ppFmt.format(a.pct)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
      {anomalies.spikes.length > 0 && (
        <Card>
          <InsightHeader Icon={Zap} iconColor="#f59e0b" label="Picos atípicos (esta semana)" />
          <Subtle>Subieron 50%+ vs su promedio de 4 semanas.</Subtle>
          <ul className="mt-3 space-y-2">
            {anomalies.spikes.map((a) => (
              <li key={a.key} className="flex items-baseline gap-3 text-xs">
                <span className="min-w-0 flex-1 truncate font-medium text-neutral-800">
                  {a.key}
                </span>
                <span className="text-neutral-500 tabular-nums">
                  {numberFmt.format(a.current)} vs ~{numberFmt.format(Math.round(a.baseline))}
                </span>
                <span className="font-semibold text-amber-700 tabular-nums">
                  {ppFmt.format(a.pct)}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

const safePct = (a: number, b: number): number => (b > 0 ? a / b : 0);

// ─────────────────────────────────────────────────────────────────────────────
// Public

export function InsightFeed({ insights }: { insights: MetricsInsights }) {
  return (
    <div className="space-y-8">
      <Section title="Resumen ejecutivo">
        <ExecutiveCard exec={insights.executive} />
      </Section>

      <Section
        title="Cola de QA"
        description="Templates editados recientemente que requieren revisión."
      >
        <QAQueueSection qa={insights.qaQueue} />
      </Section>

      <Section
        title="Top 10 piezas más efectivas"
        description="Ordenadas por open rate, con los subjects probables del catálogo."
      >
        <TopOpensSection topOpens={insights.topOpens} />
      </Section>

      <Section
        title="Movimiento semanal"
        description="Comparativa de la última semana cerrada vs la anterior."
      >
        <WeeklySection weekly={insights.weekly} />
      </Section>

      <Section title="Lo que mejor funciona">
        <WinnersSection winners={insights.winners} />
      </Section>

      <Section title="Lo que necesita atención">
        <AttentionSection attention={insights.attention} />
      </Section>

      <Section title="Patrones de contenido" description="Anatomía de los subjects de tus correos.">
        <SubjectsSection subjects={insights.subjects} />
      </Section>

      <Section title="Salud operacional">
        <HealthSection health={insights.health} />
      </Section>

      <Section
        title="Anomalías de volumen"
        description="Cambios drásticos vs el promedio de las últimas 4 semanas."
      >
        <VolumeAnomaliesSection anomalies={insights.volumeAnomalies} />
      </Section>

      <Section
        title="Templates zombi"
        description="Templates con tema activo que llevan más de 60 días sin enviarse — candidatos para limpieza."
      >
        <ZombiesSection zombies={insights.zombies} />
      </Section>
    </div>
  );
}
