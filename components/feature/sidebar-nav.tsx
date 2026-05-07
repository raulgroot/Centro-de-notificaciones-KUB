"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BarChart3, Bell, GitBranch, LogOut, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { KublauIcon } from "@/components/ui/logo";
import { Avatar } from "@/components/ui/avatar";

const NAV = [
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/flows", label: "Flujos", icon: GitBranch },
  { href: "/creation", label: "Crear", icon: Plus },
  { href: "/qa", label: "QA", icon: ShieldCheck },
] as const;

interface SidebarNavProps {
  email?: string;
  signOutAction?: () => Promise<void>;
}

/**
 * Collapsible sidebar. Default state is collapsed (icons only).
 * Hovering anywhere on the sidebar expands it with smooth animation.
 */
export function SidebarNav({ email, signOutAction }: SidebarNavProps) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      className={cn(
        "bg-brand-600 flex shrink-0 flex-col text-white shadow-sm transition-[width] duration-200 ease-out",
        expanded ? "w-60" : "w-16",
      )}
    >
      {/* Logo — fixed height + same horizontal anchor in both states so the
          icon does not "jump" when the sidebar expands. */}
      <Link
        href="/notifications"
        className="flex h-16 items-center gap-3 overflow-hidden border-b border-white/10 pr-4 pl-[14px] text-white"
        aria-label="Inicio"
      >
        <KublauIcon className="h-8 w-8 shrink-0 [&>path]:fill-white" />
        <span
          className={cn(
            "text-2xl font-bold tracking-tight whitespace-nowrap transition-opacity duration-150",
            expanded ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        >
          kublau
        </span>
      </Link>

      {/* Nav */}
      <nav className={cn("flex-1 space-y-1 py-4", expanded ? "px-3" : "px-2")}>
        {NAV.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              title={!expanded ? label : undefined}
              className={cn(
                "flex h-10 items-center gap-3 overflow-hidden rounded-md text-sm font-medium transition",
                expanded ? "px-3" : "justify-center",
                isActive
                  ? "text-brand-600 bg-white shadow-sm"
                  : "text-white/85 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-brand-600")} />
              <span
                className={cn(
                  "truncate transition-opacity duration-150",
                  expanded ? "opacity-100" : "pointer-events-none w-0 opacity-0",
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {email && (
        <div className={cn("border-t border-white/10 py-3", expanded ? "px-3" : "px-2")}>
          <div className={cn("flex items-center gap-2.5", !expanded && "justify-center")}>
            <Avatar email={email} size="md" className="border border-white/20" />
            <div
              className={cn(
                "min-w-0 flex-1 transition-opacity duration-150",
                expanded ? "opacity-100" : "pointer-events-none w-0 opacity-0",
              )}
            >
              <div className="truncate text-xs font-semibold text-white">{prettyName(email)}</div>
              <div className="truncate text-[11px] text-white/60">{email}</div>
            </div>
            {expanded && signOutAction && (
              <form action={signOutAction}>
                <button
                  type="submit"
                  aria-label="Cerrar sesión"
                  className="rounded p-1.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}

function prettyName(email: string): string {
  const local = email.split("@")[0] ?? email;
  return (
    local
      .split(/[._-]/)
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") || email
  );
}
