import Link from "next/link";
import { ArrowRight, GitBranch } from "lucide-react";
import { listFlows } from "@/lib/adapters/supabase/flows";
import { PageHeader } from "@/components/feature/page-header";

export const dynamic = "force-dynamic";

export default async function FlowsPage() {
  const flows = await listFlows();

  return (
    <div>
      <PageHeader
        title="Flujos"
        description="Walkthroughs paso a paso de los journeys de comunicación HSBC."
      />

      {flows.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {flows.map((f) => (
            <Link
              key={f.id}
              href={`/flows/${f.slug}`}
              className="group rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:border-neutral-300 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{
                    background: `${f.accentColor}1A`,
                    color: f.accentColor,
                  }}
                >
                  <GitBranch className="h-5 w-5" />
                </div>
                <ArrowRight className="h-4 w-4 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-neutral-700" />
              </div>
              <h2 className="mt-3 text-base font-semibold text-neutral-900">{f.name}</h2>
              {f.subtitle && (
                <p className="mt-1 text-xs leading-relaxed text-neutral-600">{f.subtitle}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-8 text-center">
      <h2 className="text-base font-semibold text-neutral-900">Aún no hay flujos</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Aplica el SQL de seed para sembrar el flujo de Redirección. Más flujos se agregan desde
        Supabase o desde la interfaz admin (próximamente).
      </p>
    </div>
  );
}
