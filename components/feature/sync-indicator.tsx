import { revalidatePath } from "next/cache";
import { RefreshCw } from "lucide-react";
import { runSync, getLastSyncedAt } from "@/lib/sync/notifications";

const dateFmt = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

const relative = (d: Date | null): string => {
  if (!d) return "nunca";
  const diff = (d.getTime() - Date.now()) / (1000 * 60);
  if (Math.abs(diff) < 1) return "justo ahora";
  if (Math.abs(diff) < 60) return dateFmt.format(Math.round(diff), "minute");
  if (Math.abs(diff) < 60 * 24) return dateFmt.format(Math.round(diff / 60), "hour");
  return dateFmt.format(Math.round(diff / 60 / 24), "day");
};

async function refreshAction() {
  "use server";
  try {
    await runSync("manual");
  } catch {
    // Errors are recorded in sync_runs; the UI will reflect the stale timestamp.
  }
  revalidatePath("/", "layout");
}

export async function SyncIndicator() {
  let lastSynced: Date | null = null;
  try {
    lastSynced = await getLastSyncedAt();
  } catch {
    // Supabase not configured yet — render disabled state.
  }

  return (
    <form action={refreshAction} className="flex items-center gap-2">
      <span className="hidden text-xs text-neutral-500 sm:inline">
        Sync: <span className="font-medium text-neutral-700">{relative(lastSynced)}</span>
      </span>
      <button
        type="submit"
        title="Refrescar desde Kublau"
        className="flex h-8 items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-2.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">Refrescar</span>
      </button>
    </form>
  );
}
