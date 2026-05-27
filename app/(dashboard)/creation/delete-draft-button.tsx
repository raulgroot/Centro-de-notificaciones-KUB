"use client";

/**
 * Botón "Borrar" para una fila de draft.
 *
 * Doble confirmación (UX simple):
 *   1. Click 1 → cambia el ícono a 🗑 + "¿Seguro?" en rojo (5 seg)
 *   2. Click 2 dentro de la ventana → ejecuta delete
 *   3. Si no haces nada en 5 seg, vuelve al estado neutral
 *
 * Esto evita un modal/dialog innecesario pero también previene borrados
 * accidentales por dedo torpe.
 */

import { useState, useTransition } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { deleteDraftAction } from "./actions";

export function DeleteDraftButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    // Prevent the parent <Link> from navigating into the draft.
    e.preventDefault();
    e.stopPropagation();
    if (!confirming) {
      setConfirming(true);
      // Auto-cancela la confirmación si no haces click otra vez en 5 seg.
      setTimeout(() => setConfirming(false), 5000);
      return;
    }
    startTransition(() => {
      deleteDraftAction(id).catch((err) => {
        console.error("Failed to delete draft", err);
        setConfirming(false);
      });
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      title={confirming ? `Click otra vez para borrar "${name}"` : "Borrar draft"}
      aria-label={confirming ? "Confirmar borrar" : "Borrar"}
      className={`inline-flex h-7 items-center gap-1 rounded-md border px-2 text-[11px] font-medium transition ${
        confirming
          ? "border-rose-300 bg-rose-50 text-rose-700 hover:bg-rose-100"
          : "border-transparent text-neutral-400 hover:border-neutral-200 hover:bg-neutral-100 hover:text-rose-600"
      } disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Trash2 className="h-3.5 w-3.5" />
      )}
      {confirming && <span>¿Seguro?</span>}
    </button>
  );
}
