import Link from "next/link";
import { Grid2x2, LayoutGrid, List } from "lucide-react";

export type NotificationView = "groups" | "cards" | "list";

/**
 * Segmented control to switch between the three notification views. Each
 * option is a Link so state lives in the URL (preserves filters when
 * switching, plus the back button works). We keep all other search params
 * intact by spreading `currentParams`.
 */
export function NotificationViewToggle({
  current,
  currentParams,
}: {
  current: NotificationView;
  currentParams: Record<string, string | undefined>;
}) {
  const options: { value: NotificationView; label: string; icon: typeof Grid2x2 }[] = [
    { value: "groups", label: "Grupos", icon: LayoutGrid },
    { value: "cards", label: "Cards", icon: Grid2x2 },
    { value: "list", label: "Lista", icon: List },
  ];

  function hrefFor(value: NotificationView): string {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(currentParams)) {
      if (v && k !== "view" && k !== "offset") params.set(k, v);
    }
    if (value !== "groups") params.set("view", value);
    const qs = params.toString();
    return qs ? `/notifications?${qs}` : "/notifications";
  }

  return (
    <div
      role="tablist"
      aria-label="Vista de notificaciones"
      className="inline-flex items-center rounded-md border border-neutral-200 bg-white p-0.5 shadow-sm"
    >
      {options.map((opt) => {
        const active = opt.value === current;
        const Icon = opt.icon;
        return (
          <Link
            key={opt.value}
            href={hrefFor(opt.value)}
            role="tab"
            aria-selected={active}
            className={`inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition ${
              active
                ? "bg-neutral-900 text-white shadow-sm"
                : "text-neutral-600 hover:bg-neutral-100"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
