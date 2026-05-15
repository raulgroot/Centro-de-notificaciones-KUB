import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getDraft } from "@/lib/adapters/supabase/notification-drafts";
import { DraftEditor } from "./editor";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function DraftEditPage({ params }: { params: Params }) {
  const { id } = await params;
  const draft = await getDraft(id);
  if (!draft) notFound();

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-200 bg-white px-5 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/creation"
            className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition hover:text-neutral-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver
          </Link>
          <div className="h-4 w-px bg-neutral-300" aria-hidden />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-neutral-900">{draft.name}</div>
            <div className="text-[11px] text-neutral-500">Borrador · guardado automáticamente</div>
          </div>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <DraftEditor draft={draft} />
      </div>
    </div>
  );
}
