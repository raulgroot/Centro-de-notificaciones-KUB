import { signOut } from "@/auth";
import { LogOut } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";

export function UserMenu({ email }: { email: string }) {
  const local = email.split("@")[0] ?? email;
  // "raul.robles" → "Raul Robles", "rrobles" → "Rrobles", etc.
  const displayName =
    local
      .split(/[._-]/)
      .filter(Boolean)
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(" ") || email;

  return (
    <div className="mt-2 flex items-center gap-3 border-t border-neutral-200 px-2 pt-4">
      <Avatar email={email} size="md" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-neutral-900">{displayName}</div>
        <div className="truncate text-xs text-neutral-500">{email}</div>
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
          className="rounded p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-700"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
