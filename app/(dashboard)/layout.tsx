import Link from "next/link";
import type { ReactNode } from "react";
import { Bell, GitBranch, Plus, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { UserMenu } from "@/components/feature/user-menu";

const NAV = [
  { href: "/notifications", label: "Notificaciones", icon: Bell },
  { href: "/flows", label: "Flujos", icon: GitBranch },
  { href: "/creation", label: "Crear", icon: Plus },
  { href: "/qa", label: "QA", icon: ShieldCheck },
] as const;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (
    <div className="flex min-h-screen w-full">
      <aside className="flex w-60 shrink-0 flex-col border-r border-neutral-200 bg-neutral-50 p-4">
        <Link
          href="/notifications"
          className="mb-8 px-2 text-sm font-semibold tracking-wider text-neutral-500 uppercase"
        >
          Kublau · Notis
        </Link>
        <nav className="flex-1 space-y-1">
          {NAV.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-neutral-700 transition hover:bg-neutral-200/60"
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>
        {email && <UserMenu email={email} />}
      </aside>
      <main className="flex-1 overflow-y-auto p-8">{children}</main>
    </div>
  );
}
