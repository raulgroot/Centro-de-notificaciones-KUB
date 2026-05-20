/**
 * Export Excel — todas las piezas "alta nueva" en Kublau.
 *
 * Columnas en el .xlsx:
 *   - Nombre (NOMBRE DE THEME/TRIGGER)
 *   - Producto
 *   - Movimiento (limpio, sin brackets)
 *   - Tipo de cliente
 *   - Asunto del correo
 *   - Link al theme en Kublau  ← lo que pidió el usuario
 *   - Última actualización
 *   - ID (para trazabilidad)
 *
 * Output: ./exports/alta-nueva-<YYYY-MM-DD>.xlsx
 *
 * Uso: pnpm export:alta-nueva
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as XLSX from "xlsx";
import { getClickhouseClient } from "@/lib/adapters/clickhouse-kublau/client";

interface Row {
  id: string;
  "NOMBRE DE THEME/TRIGGER": string;
  PRODUCTO: string;
  MOVIMIENTO: string;
  "TIPO DE CLIENTE": string;
  "ASUNTO DEL CORREO": string;
  "LINK AL THEME O TRIGGER": string;
  "LINK AL THEME/TEMPLATE": string;
  "ULTIMA ACTUALIZACIÓN": string | null;
  "FECHA DE ENVIO": string | null;
}

/** Convierte un array-string tipo `["alta nueva","reposicion"]` en `alta nueva, reposicion`. */
function cleanArrayString(s: string | null | undefined): string {
  if (!s || s === "[]") return "";
  try {
    const parsed = JSON.parse(s) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String).join(", ");
  } catch {
    /* fallthrough */
  }
  return String(s)
    .replace(/^\[|\]$/g, "")
    .replace(/"/g, "");
}

async function main() {
  const client = getClickhouseClient();
  console.log("→ Conectando a Kublau ClickHouse…");

  const result = await client.query({
    query: `
      SELECT
        id,
        \`NOMBRE DE THEME/TRIGGER\`,
        PRODUCTO,
        MOVIMIENTO,
        \`TIPO DE CLIENTE\`,
        \`ASUNTO DEL CORREO\`,
        \`LINK AL THEME O TRIGGER\`,
        \`LINK AL THEME/TEMPLATE\`,
        \`ULTIMA ACTUALIZACIÓN\`,
        \`FECHA DE ENVIO\`
      FROM blazer_query_401
      WHERE MOVIMIENTO LIKE '%alta nueva%'
      ORDER BY PRODUCTO ASC, \`NOMBRE DE THEME/TRIGGER\` ASC
    `,
    format: "JSONEachRow",
  });
  const rows = (await result.json()) as Row[];

  console.log(`✓ ${rows.length} piezas encontradas.`);

  // Mapear a la forma que queremos en el Excel (headers limpios, columnas
  // en el orden que pide el usuario).
  const data = rows.map((r) => ({
    Nombre: r["NOMBRE DE THEME/TRIGGER"],
    Producto: r.PRODUCTO,
    Movimiento: cleanArrayString(r.MOVIMIENTO),
    "Tipo de cliente": cleanArrayString(r["TIPO DE CLIENTE"]),
    Asunto: r["ASUNTO DEL CORREO"],
    "Link al theme (Kublau)": r["LINK AL THEME O TRIGGER"],
    "Link al template": r["LINK AL THEME/TEMPLATE"],
    "Última actualización": r["ULTIMA ACTUALIZACIÓN"] ?? "",
    "Último envío": r["FECHA DE ENVIO"] ?? "",
    ID: r.id,
  }));

  // Build the workbook.
  const ws = XLSX.utils.json_to_sheet(data);

  // Set sensible column widths so el Excel se vea decente al abrir.
  ws["!cols"] = [
    { wch: 60 }, // Nombre
    { wch: 14 }, // Producto
    { wch: 22 }, // Movimiento
    { wch: 20 }, // Tipo cliente
    { wch: 60 }, // Asunto
    { wch: 90 }, // Link theme
    { wch: 90 }, // Link template
    { wch: 18 }, // Última act.
    { wch: 20 }, // Último envío
    { wch: 36 }, // ID
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Alta Nueva");

  // Output.
  const exportsDir = join(process.cwd(), "exports");
  mkdirSync(exportsDir, { recursive: true });
  const today = new Date().toISOString().slice(0, 10);
  const filename = `alta-nueva-${today}.xlsx`;
  const outPath = join(exportsDir, filename);

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  writeFileSync(outPath, buffer);

  console.log(`✓ Excel guardado: ${outPath}`);
  console.log(`  ${rows.length} filas, ${Object.keys(data[0] ?? {}).length} columnas.`);

  // Breakdown rápido por producto para sanity check.
  const byProduct = new Map<string, number>();
  for (const r of rows) {
    byProduct.set(r.PRODUCTO, (byProduct.get(r.PRODUCTO) ?? 0) + 1);
  }
  console.log("\nDistribución por producto:");
  for (const [p, n] of [...byProduct.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${p || "(sin producto)"}`);
  }

  await client.close();
}

main().catch((err) => {
  console.error("\n✗ Error:", err);
  process.exit(1);
});
