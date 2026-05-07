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
 * Collapsible sidebar. Default state is collapsed (icons only as 40×40 squares).
 * Hovering anywhere on the sidebar expands it with smooth animation.
 */
export function SidebarNav({ email, signOutAction }: SidebarNavProps) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
      style={{
        background: "linear-gradient(180deg, #1280ff 0%, #006bff 35%, #0059d9 100%)",
      }}
      className={cn(
        "flex shrink-0 flex-col text-white shadow-sm transition-[width] duration-200 ease-out",
        expanded ? "w-60" : "w-16",
      )}
    >
      {/* Logo */}
      <Link
        href="/notifications"
        className={cn(
          "flex h-16 items-center gap-3 overflow-hidden border-b border-white/10 text-white",
          expanded ? "px-4" : "justify-center px-0",
        )}
        aria-label="Inicio"
      >
        <KublauIcon className="h-8 w-8 shrink-0 [&>path]:fill-white" />
        {expanded && (
          <span className="text-2xl font-bold tracking-tight whitespace-nowrap">kublau</span>
        )}
      </Link>

      {/* Nav — each item is a 40×40 square when collapsed, centered. */}
      <nav className="flex-1 py-4">
        <ul className="space-y-1.5">
          {NAV.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <li key={href} className={cn("flex", expanded ? "px-3" : "justify-center")}>
                <Link
                  href={href}
                  title={!expanded ? label : undefined}
                  className={cn(
                    "flex items-center rounded-md text-sm font-medium transition",
                    expanded ? "h-10 w-full gap-3 px-3" : "h-10 w-10 justify-center",
                    isActive
                      ? "text-brand-600 bg-white shadow-sm"
                      : "text-white/85 hover:bg-white/10 hover:text-white",
                  )}
                >
                  <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-brand-600")} />
                  {expanded && <span className="truncate">{label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User */}
      {email && (
        <div className={cn("border-t border-white/10 py-3", expanded ? "px-3" : "px-3")}>
          <div className={cn("flex items-center gap-2.5", !expanded && "justify-center")}>
            <Avatar email={email} size="md" className="border border-white/20" />
            {expanded && (
              <>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs font-semibold text-white">
                    {prettyName(email)}
                  </div>
                  <div className="truncate text-[11px] text-white/60">{email}</div>
                </div>
                {signOutAction && (
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
              </>
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
