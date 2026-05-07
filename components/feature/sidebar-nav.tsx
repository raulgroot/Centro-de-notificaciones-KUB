"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, GitBranch, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Sidebar navigation. Self-contained because icon component references can't
 * cross the Server → Client boundary as serializable props.
 */
const NAV = [
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/metrics", label: "Métricas", icon: BarChart3 },
  { href: "/flows", label: "Flujos", icon: GitBranch },
  { href: "/creation", label: "Crear", icon: Plus },
  { href: "/qa", label: "QA", icon: ShieldCheck },
] as const;

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-0.5">
      {NAV.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition",
              isActive
                ? "bg-brand-50 text-brand-600"
                : "text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900",
            )}
          >
            <Icon
              className={cn("h-[18px] w-[18px]", isActive ? "text-brand-600" : "text-neutral-500")}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
