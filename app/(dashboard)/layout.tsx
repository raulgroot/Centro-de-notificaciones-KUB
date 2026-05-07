import type { ReactNode } from "react";
import { auth, signOut } from "@/auth";
import { SidebarNav } from "@/components/feature/sidebar-nav";
import { TopBar } from "@/components/feature/top-bar";

async function signOutAction() {
  "use server";
  await signOut({ redirectTo: "/login" });
}

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? "";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-neutral-50">
      <SidebarNav email={email} signOutAction={email ? signOutAction : undefined} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar email={email || null} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-7xl px-8 py-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
