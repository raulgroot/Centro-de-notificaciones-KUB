import Link from "next/link";
import { Settings } from "lucide-react";
import {
  listCampaignDefinitions,
  listCampaignLoads,
  listCampaignMilestones,
} from "@/lib/adapters/supabase/campaigns";
import { computeCampaignTimeline } from "@/lib/core/campaigns/timeline";
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
  const [definitions, milestones, activeLoads, completedLoads] = await Promise.all([
    listCampaignDefinitions(),
    listCampaignMilestones(),
    listCampaignLoads({ status: "active" }),
    listCampaignLoads({ status: "completed" }),
  ]);

  const defById = new Map(definitions.map((d) => [d.id, d]));
  const milestonesByCampaign = new Map<string, typeof milestones>();
  for (const m of milestones) {
    const arr = milestonesByCampaign.get(m.campaignId) ?? [];
    arr.push(m);
    milestonesByCampaign.set(m.campaignId, arr);
  }

  const today = now();
  const buildViews = (rows: typeof activeLoads) =>
    rows
      .map((load) => {
        const def = defById.get(load.campaignId);
        if (!def) return null;
        const ms = milestonesByCampaign.get(load.campaignId) ?? [];
        return { def, view: computeCampaignTimeline(load, ms, today) };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

  const views = buildViews(activeLoads);
  const archivedViews = buildViews(completedLoads);

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
            <div className="flex flex-wrap items-start justify-between gap-3">
              <NewLoadForm campaigns={definitions.filter((d) => d.active)} />
              <AsanaSyncButton />
            </div>

            {views.length === 0 ? (
              <NoActiveLoads />
            ) : (
              <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
                {views.map(({ def, view }) => (
                  <CampaignCard key={view.load.id} definition={def} view={view} />
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
