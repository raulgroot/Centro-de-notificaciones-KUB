"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MoreVertical, Trash2, Pause, CheckCircle2, Play, AlertTriangle } from "lucide-react";
import { deleteLoadAction, updateLoadAction } from "./actions";
import type { CampaignLoad } from "@/lib/adapters/supabase/campaigns";

/**
 * Per-card actions: delete, pause, mark completed, reactivate. Renders as a
 * `⋯` icon button that opens a small popover. Delete requires inline
 * confirmation (no browser `confirm()` — keeps the UX consistent).
 *
 * Click-outside closes the menu; pressing the same trigger toggles it.
 */
export function CardActionsMenu({
  loadId,
  status,
}: {
  loadId: string;
  status: CampaignLoad["status"];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
        setError(null);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const close = () => {
    setOpen(false);
    setConfirmDelete(false);
    setError(null);
  };

  const handleStatus = (newStatus: CampaignLoad["status"]) => {
    setError(null);
    startTransition(async () => {
      const r = await updateLoadAction(loadId, { status: newStatus });
      if (!r.ok) setError(r.error);
      else {
        close();
        router.refresh();
      }
    });
  };

  const handleDelete = () => {
    setError(null);
    startTransition(async () => {
      const r = await deleteLoadAction(loadId);
      if (!r.ok) setError(r.error);
      else {
        close();
        router.refresh();
      }
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1.5 text-neutral-500 transition hover:bg-neutral-100 hover:text-neutral-900"
        aria-label="Acciones"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <MoreVertical className="h-4 w-4" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute top-9 right-0 z-10 w-56 overflow-hidden rounded-md border border-neutral-200 bg-white shadow-lg"
        >
          {!confirmDelete ? (
            <ul className="py-1 text-sm">
              {status !== "active" && (
                <MenuItem
                  Icon={Play}
                  iconColor="text-emerald-600"
                  label="Reactivar"
                  disabled={isPending}
                  onClick={() => handleStatus("active")}
                />
              )}
              {status !== "completed" && (
                <MenuItem
                  Icon={CheckCircle2}
                  iconColor="text-blue-600"
                  label="Marcar como completada"
                  disabled={isPending}
                  onClick={() => handleStatus("completed")}
                />
              )}
              {status !== "paused" && (
                <MenuItem
                  Icon={Pause}
                  iconColor="text-amber-600"
                  label="Pausar"
                  disabled={isPending}
                  onClick={() => handleStatus("paused")}
                />
              )}
              <div className="my-1 border-t border-neutral-100" />
              <MenuItem
                Icon={Trash2}
                iconColor="text-red-600"
                label="Eliminar"
                destructive
                disabled={isPending}
                onClick={() => setConfirmDelete(true)}
              />
            </ul>
          ) : (
            <div className="p-3">
              <div className="flex items-start gap-2 text-xs text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                <span>
                  ¿Eliminar esta carga? Esta acción no se puede deshacer.
                  {status === "active" && (
                    <>
                      {" "}
                      <strong>Si vino de Asana</strong>, va a volver a aparecer en la próxima
                      sincronización.
                    </>
                  )}
                </span>
              </div>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="rounded-md px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-100"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "Eliminando…" : "Sí, eliminar"}
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="border-t border-red-200 bg-red-50 p-2 text-[11px] text-red-700">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MenuItem({
  Icon,
  iconColor,
  label,
  onClick,
  disabled = false,
  destructive = false,
}: {
  Icon: typeof Trash2;
  iconColor: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <li role="none">
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        disabled={disabled}
        className={`flex w-full items-center gap-2 px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50 ${
          destructive ? "hover:bg-red-50" : "hover:bg-neutral-50"
        }`}
      >
        <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        <span className={destructive ? "text-red-700" : "text-neutral-800"}>{label}</span>
      </button>
    </li>
  );
}
