import type { ReactNode } from "react";
import { auth } from "@/auth";
import { KublauLogo } from "@/components/ui/logo";
import { SidebarNav } from "@/components/feature/sidebar-nav";
import { UserMenu } from "@/components/feature/user-menu";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (
    <div className="flex min-h-screen w-full bg-neutral-50/40">
      <aside className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white px-4 py-5">
        <div className="mb-8 px-2">
          <KublauLogo />
        </div>
        <div className="flex-1">
          <SidebarNav />
        </div>
        {email && <UserMenu email={email} />}
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
