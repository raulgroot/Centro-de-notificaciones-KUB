import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, ListChecks, MousePointerClick } from "lucide-react";
import { getFlowBySlug } from "@/lib/adapters/supabase/flows";
import { PresentationMode } from "./presentation-mode";
import "./flow-mockups.css";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export default async function FlowDetailPage({ params }: { params: Params }) {
  const { slug } = await params;
  const result = await getFlowBySlug(slug);
  if (!result) notFound();
  const { flow, steps } = result;

  return (
    <div className="space-y-6">
      <Link
        href="/flows"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition hover:text-neutral-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Volver a flujos
      </Link>

      {/* Header */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-neutral-200 pb-6">
        <div className="min-w-0">
          <div
            className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium"
            style={{ background: `${flow.accentColor}1A`, color: flow.accentColor }}
          >
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ background: flow.accentColor }}
            />
            Documentación de flujo
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-neutral-900">{flow.name}</h1>
          {flow.subtitle && (
            <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-neutral-600">
              {flow.subtitle}
            </p>
          )}
        </div>
        <PresentationMode flow={flow} steps={steps} />
      </header>

      {/* Rules section */}
      {flow.rules.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Reglas y restricciones
          </h2>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {flow.rules.map((rule) => (
              <div
                key={rule.category}
                className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm"
              >
                <h3 className="text-sm font-semibold text-neutral-900">{rule.category}</h3>
                <ul className="mt-2 space-y-1.5 text-xs text-neutral-700">
                  {rule.items.map((item, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span
                        className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full"
                        style={{ background: flow.accentColor, opacity: 0.7 }}
                      />
                      <span dangerouslySetInnerHTML={{ __html: item }} />
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Steps */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          Paso a paso ({steps.length})
        </h2>
        <ol className="space-y-5">
          {steps.map((step) => (
            <li
              key={step.id}
              className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm"
            >
              <div className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_300px]">
                {/* Content */}
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold text-white"
                      style={{ background: flow.accentColor }}
                    >
                      {step.position}
                    </span>
                    <h3 className="text-base font-semibold text-neutral-900">{step.title}</h3>
                  </div>

                  {step.description && (
                    <p className="mt-2 text-sm leading-relaxed text-neutral-700">
                      {step.description}
                    </p>
                  )}

                  {step.keyPoints.length > 0 && (
                    <div className="mt-4">
                      <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
                        <ListChecks className="h-3.5 w-3.5" />
                        Puntos clave
                      </div>
                      <ul className="mt-1.5 space-y-1 text-xs text-neutral-700">
                        {step.keyPoints.map((kp, i) => (
                          <li key={i} className="flex items-start gap-1.5">
                            <span
                              className="mt-1 inline-block h-1 w-1 shrink-0 rounded-full"
                              style={{ background: flow.accentColor, opacity: 0.7 }}
                            />
                            <span>{kp}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {step.userAction && (
                    <div className="mt-4 flex items-start gap-2 rounded-md border border-neutral-200 bg-neutral-50 p-3 text-xs">
                      <MousePointerClick
                        className="mt-0.5 h-3.5 w-3.5 shrink-0"
                        style={{ color: flow.accentColor }}
                      />
                      <div>
                        <span className="font-semibold text-neutral-700">Acción del usuario:</span>{" "}
                        <span className="text-neutral-700">{step.userAction}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Mockup */}
                <div className="flex justify-center">
                  <Mockup step={step} accentColor={flow.accentColor} />
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}

function Mockup({
  step,
  accentColor,
}: {
  step: { mockupImageUrl: string | null; mockupHtml: string | null; title: string };
  accentColor: string;
}) {
  if (step.mockupImageUrl) {
    return (
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
        <Image
          src={step.mockupImageUrl}
          alt={`Mockup: ${step.title}`}
          width={300}
          height={600}
          className="h-auto w-full"
          unoptimized
        />
      </div>
    );
  }

  if (step.mockupHtml) {
    return (
      <div
        className="overflow-hidden rounded-xl border border-neutral-200 bg-white p-4 text-xs shadow-sm"
        dangerouslySetInnerHTML={{ __html: step.mockupHtml }}
      />
    );
  }

  // Placeholder when no mockup is provided.
  return (
    <div
      className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 text-[11px] text-neutral-400"
      style={{ borderColor: `${accentColor}33` }}
    >
      <span>Mockup pendiente</span>
    </div>
  );
}
