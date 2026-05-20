"use server";

import * as XLSX from "xlsx";
import { kublauSendsSource } from "@/lib/adapters/clickhouse-kublau/sends-source";
import type { LastSend } from "@/lib/ports/sends-source";

/** One row in the QA result table. */
export interface QARow {
  rowNumber: number;
  themeName: string;
  themeLink: string | null;
  modifiedAt: Date | null;
  /** Last sent timestamp (null = template never sent). */
  lastSentAt: Date | null;
  recipient: string | null;
  subject: string | null;
  postmarkUrl: string | null;
  htmlBody: string | null;
  status: "ready" | "pending" | "no-sends" | "not-found";
}

export type QAResult =
  | {
      ok: true;
      rows: QARow[];
      warnings: string[];
      /** Fecha global de referencia que se usó para clasificar (puede ser null
       *  si el usuario no la mandó — sólo aplica para retro-compat). */
      referenceDate: Date | null;
    }
  | { ok: false; error: string };

interface ParsedSheetRow {
  rowNumber: number;
  themeName: string;
  themeLink: string | null;
  modifiedAt: Date | null;
}

/** Normalize a header cell value for fuzzy matching. */
const normalizeHeader = (v: unknown): string =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const findColumnIndex = (header: unknown[], keywords: string[]): number => {
  for (let i = 0; i < header.length; i++) {
    const cell = normalizeHeader(header[i]);
    if (keywords.some((k) => cell.includes(k))) return i;
  }
  return -1;
};

const toDateOrNull = (v: unknown): Date | null => {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  if (typeof v === "number") {
    // Excel serial date number.
    const d = XLSX.SSF.parse_date_code(v);
    if (!d) return null;
    return new Date(Date.UTC(d.y, d.m - 1, d.d, d.H || 0, d.M || 0, Math.floor(d.S || 0)));
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
};

const parseSheet = (
  buffer: ArrayBuffer,
): { rows: ParsedSheetRow[]; warnings: string[] } | { error: string } => {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buffer, { cellDates: true });
  } catch (e) {
    return { error: `No pude leer el archivo: ${e instanceof Error ? e.message : String(e)}` };
  }

  const sheetName = wb.SheetNames[0];
  if (!sheetName) return { error: "El archivo no tiene hojas." };
  const sheet = wb.Sheets[sheetName];
  if (!sheet) return { error: "La primera hoja está vacía." };

  // Convert to array-of-arrays so we can inspect headers and indices freely.
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false,
  });
  if (aoa.length === 0) return { error: "La hoja está vacía." };

  const header = aoa[0] ?? [];
  const themeCol = findColumnIndex(header, ["theme", "trigger", "nombre"]);
  const dateCol = findColumnIndex(header, ["modificac", "cambio", "fecha"]);
  const linkCol = findColumnIndex(header, ["link"]);

  if (themeCol === -1) {
    return {
      error:
        'No encontré la columna del nombre del theme. Asegúrate de que el encabezado contenga "theme", "trigger" o "nombre".',
    };
  }

  const rows: ParsedSheetRow[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r) continue;
    const themeRaw = r[themeCol];
    const themeName = String(themeRaw ?? "").trim();
    if (!themeName) continue;

    const linkRaw = linkCol >= 0 ? r[linkCol] : null;
    const dateRaw = dateCol >= 0 ? r[dateCol] : null;
    const modifiedAt = toDateOrNull(dateRaw);

    if (dateCol >= 0 && dateRaw && !modifiedAt) {
      warnings.push(`Fila ${i + 1}: no pude leer la fecha "${String(dateRaw)}", se ignorará.`);
    }

    rows.push({
      rowNumber: i + 1,
      themeName,
      themeLink: typeof linkRaw === "string" && linkRaw.trim() ? linkRaw.trim() : null,
      modifiedAt,
    });
  }

  if (rows.length === 0) return { error: "No encontré filas con nombre de theme en la hoja." };
  return { rows, warnings };
};

const computeStatus = (
  modifiedAt: Date | null,
  sentAt: Date | null,
  found: boolean,
): QARow["status"] => {
  if (!found) return "not-found";
  if (!sentAt) return "no-sends";
  if (!modifiedAt) return "ready"; // sin fecha de referencia, cualquier envío vale
  return sentAt >= modifiedAt ? "ready" : "pending";
};

/**
 * Convierte `YYYY-MM-DD` del date input HTML a un Date en el inicio de ese
 * día en CDMX (UTC-6, sin DST porque México lo eliminó en 2022). Eso
 * coincide con el modelo mental del usuario "subí mis cambios el día X" —
 * cualquier envío de Kublau en ese día o después cuenta como "después de
 * los cambios".
 *
 * Devuelve null si el string no es una fecha válida.
 */
const parseReferenceDate = (raw: string | null): Date | null => {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const d = new Date(`${raw}T00:00:00-06:00`);
  return Number.isNaN(d.getTime()) ? null : d;
};

export async function processQASheet(formData: FormData): Promise<QAResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: "No se recibió ningún archivo." };
  }
  if (file.size === 0) {
    return { ok: false, error: "El archivo está vacío." };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { ok: false, error: "El archivo supera el límite de 5 MB." };
  }

  // Fecha global de referencia — viene del date input del formulario.
  // Si por algún caso edge falta (form sin date input antiguo), seguimos
  // funcionando como antes pero con la lógica de fallback más conservadora.
  const referenceDate = parseReferenceDate(formData.get("referenceDate") as string | null);

  const buffer = await file.arrayBuffer();
  const parsed = parseSheet(buffer);
  if ("error" in parsed) return { ok: false, error: parsed.error };

  const themeNames = parsed.rows.map((r) => r.themeName);

  let sendsByTheme: Map<string, LastSend>;
  try {
    sendsByTheme = await kublauSendsSource.getLastSendsByThemeNames(themeNames);
  } catch (e) {
    return {
      ok: false,
      error: `Error al consultar Kublau: ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const rows: QARow[] = parsed.rows.map((r) => {
    const send = sendsByTheme.get(r.themeName);
    const found = Boolean(send);
    const lastSentAt = send?.sentAt ?? null;
    // Per-row date from the Excel beats the global reference; if neither,
    // status falls back to "ready when there's any send" (old behavior).
    const effectiveModifiedAt = r.modifiedAt ?? referenceDate;
    return {
      rowNumber: r.rowNumber,
      themeName: r.themeName,
      themeLink: send?.themeLink ?? r.themeLink,
      modifiedAt: effectiveModifiedAt,
      lastSentAt,
      recipient: send?.recipient ?? null,
      subject: send?.subject ?? null,
      postmarkUrl: send?.postmarkUrl ?? null,
      htmlBody: send?.htmlBody ?? null,
      status: computeStatus(effectiveModifiedAt, lastSentAt, found),
    };
  });

  return { ok: true, rows, warnings: parsed.warnings, referenceDate };
}
