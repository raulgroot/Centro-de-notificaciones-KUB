/**
 * Cron horario: revisa las QA batches activas y dispara notificaciones de
 * "item_ready" cuando un theme pendiente ya se mandó después de su fecha
 * de referencia.
 *
 * Lógica:
 *   1. Lista TODOS los items con `became_ready_at IS NULL` (de cualquier
 *      batch activo de cualquier usuario).
 *   2. Junta los theme names únicos y los busca en Kublau (en chunks, ya
 *      maneja eso el adapter).
 *   3. Para cada item, compara el lastSentAt actual contra la fecha de
 *      referencia del batch:
 *        - Si lastSentAt >= referenceDate → transición a "ready".
 *          - Marca becameReadyAt en el item.
 *          - Crea qa_notification (kind: "item_ready").
 *        - Si no → solo actualiza el snapshot actual (currentStatus,
 *          lastCheckedAt) sin notificar.
 *
 * Idempotente: si el cron corre 2× sobre el mismo item ya ready, la query
 * de items pendientes lo excluye automáticamente.
 *
 * Auth: GET exige el Bearer `CRON_SECRET` (igual que /api/sync); POST exige
 * sesión vía middleware. La exención de auth.config.ts solo aplica a GET.
 */

import { NextResponse, type NextRequest } from "next/server";
import { rejectUnauthorizedCron } from "@/lib/cron-auth";
import { kublauSendsSource } from "@/lib/adapters/clickhouse-kublau/sends-source";
import {
  createNotification,
  listPendingItemsAcrossAllBatches,
  updateItemStatus,
} from "@/lib/adapters/supabase/qa-batches";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Stats = {
  itemsChecked: number;
  transitionsDetected: number;
  errorsSkipped: number;
};

async function runCheck(): Promise<Stats> {
  const pending = await listPendingItemsAcrossAllBatches();
  if (pending.length === 0) {
    return { itemsChecked: 0, transitionsDetected: 0, errorsSkipped: 0 };
  }

  // Junta theme names únicos para una sola query a Kublau (el adapter
  // chunkea internamente para evitar el 414).
  const themeNames = [...new Set(pending.map((p) => p.themeName))];
  const sends = await kublauSendsSource.getLastSendsByThemeNames(themeNames);

  let transitions = 0;
  let errors = 0;

  for (const item of pending) {
    const send = sends.get(item.themeName);
    try {
      const found = Boolean(send);
      const lastSentAt = send?.sentAt ?? null;

      // Compute current status mirroring the QA processing logic.
      const status: "ready" | "pending" | "no-sends" | "not-found" = !found
        ? "not-found"
        : !lastSentAt
          ? "no-sends"
          : lastSentAt >= item.referenceDate
            ? "ready"
            : "pending";

      const becameReadyAt = status === "ready" ? new Date() : null;

      await updateItemStatus({
        itemId: item.id,
        currentStatus: status,
        currentLastSentAt: lastSentAt,
        becameReadyAt,
      });

      if (becameReadyAt) {
        await createNotification({
          ownerEmail: item.ownerEmail,
          batchId: item.batchId,
          itemId: item.id,
          kind: "item_ready",
          themeName: item.themeName,
          payload: { sentAt: lastSentAt?.toISOString() },
        });
        transitions++;
      }
    } catch (e) {
      console.error(
        `[qa-cron] skipping item ${item.id} (${item.themeName}):`,
        e instanceof Error ? e.message : e,
      );
      errors++;
    }
  }

  return {
    itemsChecked: pending.length,
    transitionsDetected: transitions,
    errorsSkipped: errors,
  };
}

export async function GET(req: NextRequest) {
  const unauthorized = rejectUnauthorizedCron(req);
  if (unauthorized) return unauthorized;
  return runAndReturn();
}

// También aceptamos POST por si en el futuro queremos disparar a mano
// desde un botón "Refrescar ahora" de la UI. El middleware exige sesión
// para POST (la exención de auth.config.ts es solo para GET).
export async function POST() {
  return runAndReturn();
}

async function runAndReturn() {
  try {
    const stats = await runCheck();
    return NextResponse.json({ ok: true, stats });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
