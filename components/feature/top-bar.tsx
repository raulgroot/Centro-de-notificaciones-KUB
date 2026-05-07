import { SyncIndicator } from "./sync-indicator";

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
      <SyncIndicator />
    </header>
  );
}
