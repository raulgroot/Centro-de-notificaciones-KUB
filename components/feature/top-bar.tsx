import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { SyncIndicator } from "./sync-indicator";
import { countUnread } from "@/lib/adapters/supabase/qa-batches";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 19) return "Buenas tardes";
  return "Buenas noches";
}

function firstName(email: string): string {
  const local = email.split("@")[0] ?? email;
  const first = local.split(/[._-]/)[0] ?? local;
  return first.charAt(0).toUpperCase() + first.slice(1);
}

/**
 * Bell con badge de notificaciones unread. Server component que pega a
 * Supabase para contar — barato porque PostgREST hace COUNT(*) head:true.
 * Suspense alrededor en el TopBar para que si Supabase laguea, el resto
 * del topbar igual pinta inmediato.
 */
async function NotificationBell({ email }: { email: string }) {
  let count = 0;
  try {
    count = await countUnread(email);
  } catch {
    // Fallar a 0 si Supabase no responde — el bell sigue siendo navegable.
  }
  return (
    <Link
      href="/alertas"
      title={count > 0 ? `${count} sin leer` : "Sin notificaciones nuevas"}
      className="relative inline-flex h-9 w-9 items-center justify-center rounded-full text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}

function BellFallback() {
  return (
    <div className="inline-flex h-9 w-9 items-center justify-center text-neutral-300">
      <Bell className="h-4 w-4" />
    </div>
  );
}

export function TopBar({ email }: { email: string | null }) {
  const name = email ? firstName(email) : null;

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-neutral-200 bg-white px-8">
      <div>
        <div className="text-base font-semibold text-neutral-900">
          {name ? `${greeting()}, ${name}` : greeting()}
        </div>
        <div className="text-xs text-neutral-500">Centro de notificaciones · Kublau</div>
      </div>
      <div className="flex items-center gap-2">
        {email && (
          <Suspense fallback={<BellFallback />}>
            <NotificationBell email={email} />
          </Suspense>
        )}
        <SyncIndicator />
      </div>
    </header>
  );
}
