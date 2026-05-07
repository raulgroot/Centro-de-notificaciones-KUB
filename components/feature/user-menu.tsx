import { signOut } from "@/auth";
import { LogOut } from "lucide-react";

export function UserMenu({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  return (
    <div className="mt-auto flex items-center gap-2 border-t border-neutral-200 pt-4">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white">
        {initial}
      </div>
      <div className="flex-1 overflow-hidden text-xs">
        <div className="truncate text-neutral-700">{email}</div>
      </div>
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button
          type="submit"
          aria-label="Cerrar sesión"
          className="rounded p-1.5 text-neutral-500 transition hover:bg-neutral-200 hover:text-neutral-900"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
