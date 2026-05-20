import Link from "next/link";
import { AlertTriangle, Settings } from "lucide-react";
import {
  listCampaignDefinitions,
  listCampaignLoads,
  listCampaignMilestones,
} from "@/lib/adapters/supabase/campaigns";
import { computeCampaignTimeline } from "@/lib/core/campaigns/timeline";
import {
  countMissedMilestones,
  verifyCohortMilestones,
  type MilestoneVerification,
} from "@/lib/core/campaigns/verification";
import { supabaseNotificationSource as notifs } from "@/lib/adapters/supabase/notification-source";
import { CampaignCard } from "@/components/feature/campaign-card";
import { PageHeader } from "@/components/feature/page-header";
import { NewLoadForm } from "./new-load-form";
import { AsanaSyncButton } from "./sync-button";
import { ArchivedSection } from "./archived-section";

export const dynamic = "force-dynamic";

function now(): Date {
  return new Date();
}

export default async function CampanasPage() {
  const [definitions, milestones, activeLoads, completedLoads, reminderTemplates] =
    await Promise.all([
      listCampaignDefinitions(),
      listCampaignMilestones(),
      listCampaignLoads({ status: "active" }),
      listCampaignLoads({ status: "completed" }),
      // Pull every "NN reminder" template — small (~150 rows), cheap, used to
      // verify whether each milestone actually fired. listAllLight excludes
      // html_body so this stays cheap even at full table scan.
      notifs.listAllLight({ search: "reminder" }),
    ]);

  const defById = new Map(definitions.map((d) => [d.id, d]));
  const milestonesByCampaign = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const arr = milestonesByCampaign.get(m.campaignId) ?? [];
    arr.push(m);
    milestonesByCampaign.set(m.campaignId, arr);
  }

  // Verification data: minimal subset for the pure verification function.
  const sends = reminderTemplates.map((n) => ({
    themeName: n.themeName,
    lastSentAt: n.lastSentAt,
  }));
  // All loads grouped by campaign, used to detect "stale_data" cohorts.
  const loadsByCampaign = new Map<string, typeof activeLoads>();
  for (const load of [...activeLoads, ...completedLoads]) {
    const arr = loadsByCampaign.get(load.campaignId) ?? [];
    arr.push(load);
    loadsByCampaign.set(load.campaignId, arr);
  }

  const today = now();
  const buildViews = (rows: typeof activeLoads) =>
    rows
      .map((load) => {
        const def = defById.get(load.campaignId);
        if (!def) return null;
        const ms = milestonesByCampaign.get(load.campaignId) ?? [];
        const verifications: MilestoneVerification[] = verifyCohortMilestones({
          load,
          milestones: ms,
          sends,
          cohortsForCampaign: loadsByCampaign.get(load.campaignId) ?? [],
          now: today,
        });
        return { def, view: computeCampaignTimeline(load, ms, today), verifications };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

  const views = buildViews(activeLoads);
  const archivedViews = buildViews(completedLoads);

  // Total missed across active cohorts → banner at top.
  const totalMissed = views.reduce((sum, v) => sum + countMissedMilestones(v.verifications), 0);

  const showEmpty = definitions.length === 0;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Campañas"
          description="Timeline de cargas activas: Bono de Bienvenida, Retención Proactiva y otras."
        />
        <Link
          href="/campanas/admin"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
        >
          <Settings className="h-3.5 w-3.5" />
          Configurar cadencias
        </Link>
      </div>

      <div className="space-y-5">
        {showEmpty ? (
          <EmptyState />
        ) : (
          <>
            {totalMissed > 0 && <MissedBanner count={totalMissed} />}

            <div className="flex flex-wrap items-start justify-between gap-3">
              <NewLoadForm campaigns={definitions.filter((d) => d.active)} />
              <AsanaSyncButton />
            </div>

            {views.length === 0 ? (
              <NoActiveLoads />
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {views.map(({ def, view, verifications }) => (
                  <CampaignCard
                    key={view.load.id}
                    definition={def}
                    view={view}
                    verifications={verifications}
                  />
                ))}
              </div>
            )}

            <ArchivedSection views={archivedViews} />
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-8 text-center">
      <h2 className="text-base font-semibold text-neutral-900">Aún no hay campañas configuradas</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Aplica el SQL inicial en Supabase para crear Bono de Bienvenida y Retención Proactiva con
        sus cadencias por default. Luego registras la primera carga.
      </p>
      <Link
        href="/campanas/admin"
        className="bg-brand-600 hover:bg-brand-700 mt-4 inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-medium text-white transition"
      >
        <Settings className="h-3.5 w-3.5" />
        Ir a configuración
      </Link>
    </div>
  );
}

function MissedBanner({ count }: { count: number }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-rose-800 shadow-sm"
    >
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <div className="flex-1">
        <div className="text-sm font-semibold">
          {count === 1
            ? "1 notificación no se envió a tiempo"
            : `${count} notificaciones no se enviaron a tiempo`}
        </div>
        <div className="mt-0.5 text-xs leading-relaxed text-rose-700">
          La fecha esperada ya pasó y no encontramos ningún envío dentro de ±2 días. Revisa las
          cards marcadas abajo. (Detección por convención de theme_name; conectaremos Postmark para
          verificación 100% precisa por cohort.)
        </div>
      </div>
    </div>
  );
}

function NoActiveLoads() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-8 text-center">
      <h2 className="text-base font-semibold text-neutral-900">No hay cargas activas</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Cuando arranque una nueva carga, regístrala con el botón <strong>Nueva carga</strong>{" "}
        arriba.
      </p>
    </div>
  );
}
