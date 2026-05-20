"use client";

import { useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

/**
 * Botón "Marcar todas como leídas". Recibe el server action como prop
 * porque no podemos importar el server action directamente desde page.tsx
 * (lo definimos inline ahí) — el patrón estándar de Next.js 16 es pasarlo
 * como prop, así el client component sólo invoca.
 */
export function MarkAllReadButton({ action }: { action: () => Promise<void> }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      onClick={() => startTransition(() => action())}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-xs font-medium text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      Marcar todas como leídas
    </button>
  );
}
