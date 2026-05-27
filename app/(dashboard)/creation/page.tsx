import Link from "next/link";
import { PenSquare, Plus, Sparkles } from "lucide-react";
import { listDrafts } from "@/lib/adapters/supabase/notification-drafts";
import { DeleteDraftButton } from "./delete-draft-button";
import { PageHeader } from "@/components/feature/page-header";
import { createDraftAndOpenAction } from "./actions";

export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function CreationPage() {
  const drafts = await listDrafts();
  const active = drafts.filter((d) => d.status !== "archived");
  const archived = drafts.filter((d) => d.status === "archived");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crear notificación"
        description="Wizard con Claude (textos) + Freepik (imágenes). Cada borrador se guarda automáticamente."
      />

      <NewDraftForm />

      {active.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm">
          <header className="border-b border-neutral-200 px-5 py-2.5 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Borradores
          </header>
          <ul className="divide-y divide-neutral-100">
            {active.map((d) => (
              <li
                key={d.id}
                className="group relative grid grid-cols-12 items-center gap-3 transition hover:bg-neutral-50"
              >
                {/* El Link cubre toda la fila excepto el botón borrar. */}
                <Link
                  href={`/creation/${d.id}`}
                  className="col-span-11 grid grid-cols-11 gap-3 px-5 py-3.5"
                >
                  <div className="col-span-6 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold text-neutral-900">
                        {d.name || "Sin nombre"}
                      </span>
                      {d.status === "shared" && (
                        <span className="shrink-0 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                          compartido
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-neutral-500">
                      {d.copy.subject || "Sin asunto generado aún"}
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center text-xs text-neutral-500">
                    {[d.brief.product, d.brief.movement, d.brief.lifecycle]
                      .filter(Boolean)
                      .join(" · ") || "Sin brief"}
                  </div>
                  <div className="col-span-2 flex items-center justify-end text-xs text-neutral-500">
                    {fmt.format(d.updatedAt)}
                  </div>
                </Link>
                <div className="col-span-1 flex items-center justify-end pr-5">
                  <DeleteDraftButton id={d.id} name={d.name || "Sin nombre"} />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <details className="rounded-xl border border-neutral-200 bg-white shadow-sm">
          <summary className="cursor-pointer px-5 py-3 text-xs font-medium text-neutral-600">
            {archived.length} archivado{archived.length === 1 ? "" : "s"}
          </summary>
          <ul className="divide-y divide-neutral-100 border-t border-neutral-100">
            {archived.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/creation/${d.id}`}
                  className="block px-5 py-3 text-sm text-neutral-600 transition hover:bg-neutral-50"
                >
                  {d.name || "Sin nombre"}
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function NewDraftForm() {
  return (
    <form
      action={createDraftAndOpenAction}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-4"
    >
      <div className="min-w-[260px] flex-1">
        <label
          htmlFor="draft-name"
          className="block text-[11px] font-semibold tracking-wider text-neutral-500 uppercase"
        >
          Nombre del draft
        </label>
        <input
          id="draft-name"
          name="name"
          type="text"
          required
          placeholder="Ej. Aviso entrega VIVA - mayo"
          className="focus:border-brand-600 focus:ring-brand-600/15 mt-1.5 h-10 w-full rounded-md border border-neutral-300 bg-white px-3 text-sm placeholder:text-neutral-400 focus:ring-2 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="bg-brand-600 hover:bg-brand-700 inline-flex h-10 items-center gap-2 rounded-md px-4 text-sm font-medium text-white shadow-sm transition"
      >
        <Plus className="h-4 w-4" />
        Crear y empezar
      </button>
    </form>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 p-10 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-neutral-400" />
      <h2 className="mt-3 text-base font-semibold text-neutral-900">
        Aún no tienes notificaciones creadas
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Crea tu primer borrador arriba. Te ayudamos a redactar copy + sourcing de imágenes con IA.
      </p>
      <div className="mt-4 inline-flex items-center gap-1.5 text-xs text-neutral-500">
        <PenSquare className="h-3.5 w-3.5" />
        Cada borrador se guarda automáticamente
      </div>
    </div>
  );
}
