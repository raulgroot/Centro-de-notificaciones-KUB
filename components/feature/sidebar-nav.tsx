"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Bell,
  ChevronsLeft,
  ChevronsRight,
  GitBranch,
  LogOut,
  Plus,
  ShieldCheck,
} from "lucide-react";
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

export function SidebarNav({ email, signOutAction }: SidebarNavProps) {
  const [expanded, setExpanded] = useState(false);
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "bg-brand-600 flex shrink-0 flex-col text-white shadow-sm transition-[width] duration-200 ease-out",
        expanded ? "w-56" : "w-16",
      )}
    >
      {/* Logo + collapse toggle */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-white/10",
          expanded ? "justify-between px-4" : "justify-center px-2",
        )}
      >
        <Link
          href="/notifications"
          className="flex items-center gap-2 text-white"
          aria-label="Inicio"
        >
          <KublauIcon className="h-7 w-auto text-white [&>path]:fill-white" />
          {expanded && <span className="text-base font-bold tracking-tight">kublau</span>}
        </Link>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={cn(
            "rounded-md p-1 text-white/70 transition hover:bg-white/10 hover:text-white",
            !expanded && "absolute top-[1.1rem] right-3",
          )}
          aria-label={expanded ? "Colapsar menú" : "Expandir menú"}
        >
          {expanded ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
        </button>
      </div>

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
                "flex items-center gap-3 rounded-md text-sm font-medium transition",
                expanded ? "px-3 py-2" : "h-10 justify-center",
                isActive
                  ? "text-brand-600 bg-white shadow-sm"
                  : "text-white/80 hover:bg-white/10 hover:text-white",
              )}
            >
              <Icon className={cn("h-5 w-5 shrink-0", isActive && "text-brand-600")} />
              {expanded && <span className="truncate">{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User */}
      {email && (
        <div className={cn("border-t border-white/10 py-3", expanded ? "px-3" : "px-2")}>
          {expanded ? (
            <div className="flex items-center gap-2.5">
              <Avatar email={email} size="md" className="border border-white/20" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-white">{prettyName(email)}</div>
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
            </div>
          ) : (
            <div className="flex justify-center">
              <Avatar email={email} size="md" className="border border-white/20" />
            </div>
          )}
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
