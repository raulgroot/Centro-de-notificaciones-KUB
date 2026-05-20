/**
 * Inbox de notificaciones — todo lo que el cron horario detectó como
 * transición de "pendiente" a "listo" para los QA guardados del user.
 *
 * Scope: estrictamente personal (filtrado por session.user.email). Cron
 * inserta filas con `read_at = null`; al entrar a esta página, marcamos
 * todo como leído (ack inmediato). Si el user quiere preservar el
 * historial, lo verá igual aquí — sólo el badge del bell se vacía.
 */

import { auth } from "@/auth";
import Link from "next/link";
import { CheckCircle2, ArrowLeft, Inbox, Clock } from "lucide-react";
import { listBatches, listNotifications, markRead } from "@/lib/adapters/supabase/qa-batches";
import { MarkAllReadButton } from "./mark-all-read-button";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

async function markAllReadAction() {
  "use server";
  const session = await auth();
  const email = session?.user?.email;
  if (!email) return;
  await markRead({ ownerEmail: email });
  revalidatePath("/alertas");
}

export default async function AlertasPage() {
  const session = await auth();
  const email = session?.user?.email;

  if (!email) {
    return (
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        No hay sesión activa.
      </div>
    );
  }

  const [notifs, batches] = await Promise.all([
    listNotifications({ ownerEmail: email, limit: 100 }),
    listBatches(email),
  ]);

  const unread = notifs.filter((n) => !n.readAt);
  const readNotifs = notifs.filter((n) => n.readAt);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-neutral-200 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Alertas</h1>
          <p className="mt-1 text-sm text-neutral-600">
            Te aviso aquí cuando una pieza pendiente del QA empieza a salir. Se revisa cada hora.
          </p>
        </div>
        {unread.length > 0 && <MarkAllReadButton action={markAllReadAction} />}
      </header>

      {/* Activos */}
      <section>
        <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
          Sin leer ({unread.length})
        </h2>
        {unread.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-2">
            {unread.map((n) => (
              <li key={n.id}>
                <NotifCard
                  themeName={n.themeName}
                  createdAt={n.createdAt}
                  sentAt={n.payload.sentAt ? new Date(n.payload.sentAt) : null}
                  highlighted
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Historial */}
      {readNotifs.length > 0 && (
        <section>
          <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            Leídas ({readNotifs.length})
          </h2>
          <ul className="space-y-2">
            {readNotifs.map((n) => (
              <li key={n.id}>
                <NotifCard
                  themeName={n.themeName}
                  createdAt={n.createdAt}
                  sentAt={n.payload.sentAt ? new Date(n.payload.sentAt) : null}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Batches activos */}
      {batches.length > 0 && (
        <section className="border-t border-neutral-200 pt-6">
          <h2 className="mb-3 text-[11px] font-semibold tracking-wider text-neutral-500 uppercase">
            QA guardados ({batches.length})
          </h2>
          <ul className="space-y-2">
            {batches.map((b) => (
              <li key={b.id}>
                <div className="rounded-lg border border-neutral-200 bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold text-neutral-900">{b.name}</div>
                      <p className="mt-0.5 text-xs text-neutral-500">
                        Fecha de cambios:{" "}
                        <span className="font-medium text-neutral-700">
                          {dateFmt.format(b.referenceDate)}
                        </span>
                        {" · "}
                        Guardado: {dateFmt.format(b.createdAt)}
                      </p>
                    </div>
                    <Link
                      href="/qa"
                      className="text-brand-600 hover:text-brand-700 text-xs font-medium"
                    >
                      Ir a QA →
                    </Link>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="pt-4">
        <Link
          href="/qa"
          className="inline-flex items-center gap-1.5 text-sm text-neutral-600 transition hover:text-neutral-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a QA
        </Link>
      </div>
    </div>
  );
}

function NotifCard({
  themeName,
  createdAt,
  sentAt,
  highlighted = false,
}: {
  themeName: string | null;
  createdAt: Date;
  sentAt: Date | null;
  highlighted?: boolean;
}) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3.5 ${
        highlighted ? "border-emerald-200 bg-emerald-50/40" : "border-neutral-200 bg-white"
      }`}
    >
      <CheckCircle2
        className={`mt-0.5 h-5 w-5 shrink-0 ${
          highlighted ? "text-emerald-600" : "text-neutral-400"
        }`}
      />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-neutral-900">
          Pieza lista para revisar: <span className="font-semibold">{themeName ?? "—"}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-neutral-500">
          {sentAt && (
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Enviada: {dateFmt.format(sentAt)}
            </span>
          )}
          <span>Detectada: {dateFmt.format(createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-neutral-300 bg-neutral-50/40 py-10 text-center">
      <Inbox className="mb-3 h-7 w-7 text-neutral-400" />
      <div className="text-sm font-medium text-neutral-700">No hay alertas nuevas</div>
      <p className="mt-1 max-w-sm text-xs text-neutral-500">
        Cuando una pieza de tus QA guardados pase de &ldquo;pendiente&rdquo; a &ldquo;lista&rdquo;,
        aparece aquí.
      </p>
    </div>
  );
}
