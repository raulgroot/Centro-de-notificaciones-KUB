import { listCampaignDefinitions, listCampaignMilestones } from "@/lib/adapters/supabase/campaigns";
import { PageHeader } from "@/components/feature/page-header";
import { MilestoneEditor } from "./milestone-editor";

export const dynamic = "force-dynamic";

export default async function CampanasAdminPage() {
  const [campaigns, milestones] = await Promise.all([
    listCampaignDefinitions(),
    listCampaignMilestones(),
  ]);

  return (
    <div>
      <PageHeader
        title="Configuración de cadencias"
        description="Edita los milestones de cada campaña. Los cambios aplican inmediatamente al timeline."
      />
      <MilestoneEditor campaigns={campaigns} milestones={milestones} />
    </div>
  );
}
