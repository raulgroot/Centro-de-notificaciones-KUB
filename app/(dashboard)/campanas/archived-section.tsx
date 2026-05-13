"use client";

import { useState } from "react";
import { Archive, ChevronDown, ChevronRight } from "lucide-react";
import { CampaignCard } from "@/components/feature/campaign-card";
import type { CampaignDefinition } from "@/lib/adapters/supabase/campaigns";
import type { CampaignTimelineView } from "@/lib/core/campaigns/timeline";

/**
 * Collapsible section that shows campaign loads whose timeline has elapsed.
 * Hidden by default to keep the active view clean; clicking the header
 * expands the same card layout below.
 */
export function ArchivedSection({
  views,
}: {
  views: Array<{ def: CampaignDefinition; view: CampaignTimelineView }>;
}) {
  const [open, setOpen] = useState(false);
  if (views.length === 0) return null;

  return (
    <section className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-3 text-left transition hover:bg-neutral-50"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2">
          <Archive className="h-4 w-4 text-neutral-500" />
          <div>
            <div className="text-sm font-semibold text-neutral-800">
              Cargas archivadas ({views.length})
            </div>
            <div className="text-xs text-neutral-500">
              Cargas cuyo timeline ya terminó — útil para histórico.
            </div>
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-neutral-500" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-neutral-500" />
        )}
      </button>
      {open && (
        <div className="grid grid-cols-1 gap-5 border-t border-neutral-200 p-5 xl:grid-cols-2">
          {views.map(({ def, view }) => (
            <CampaignCard key={view.load.id} definition={def} view={view} />
          ))}
        </div>
      )}
    </section>
  );
}
