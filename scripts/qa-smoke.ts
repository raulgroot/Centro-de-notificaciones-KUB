import { readFileSync } from "node:fs";
import * as XLSX from "xlsx";
import { kublauSendsSource } from "/Users/raulroblesalcala/Centro de notificaciones Kublau/lib/adapters/clickhouse-kublau/sends-source";

async function main() {
  const path =
    "/Users/raulroblesalcala/Library/Mobile Documents/com~apple~CloudDocs/Kublau/2026/07 de mayo /11 de mayo/Prueba.xlsx";

  const wb = XLSX.read(readFileSync(path), { cellDates: true });
  const firstSheetName = wb.SheetNames[0]!;
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[firstSheetName]!, {
    header: 1,
    defval: null,
    raw: false,
    blankrows: false,
  });

  const themeNames = aoa
    .slice(1)
    .map((r) => String(r?.[0] ?? "").trim())
    .filter(Boolean);

  console.log(`→ Theme names en sheet: ${themeNames.length}`);
  console.log(`  primeros 3: ${JSON.stringify(themeNames.slice(0, 3))}`);

  const sends = await kublauSendsSource.getLastSendsByThemeNames(themeNames);
  console.log(`→ Encontrados en ClickHouse: ${sends.size} de ${themeNames.length}`);

  let withHtml = 0;
  let withRecentSend = 0;
  const cutoff = new Date("2026-05-01");
  for (const s of sends.values()) {
    if (s.htmlBody) withHtml++;
    if (s.sentAt && s.sentAt >= cutoff) withRecentSend++;
  }
  console.log(`  con HTML: ${withHtml}`);
  console.log(`  enviados >= 2026-05-01: ${withRecentSend}`);

  const sample = themeNames[0]!;
  const sampleSend = sends.get(sample);
  if (sampleSend) {
    console.log(`\nMuestra: ${sample}`);
    console.log(`  sentAt: ${sampleSend.sentAt?.toISOString() ?? "null"}`);
    console.log(`  recipient: ${sampleSend.recipient}`);
    console.log(`  subject: ${sampleSend.subject}`);
    console.log(`  htmlBody length: ${sampleSend.htmlBody?.length ?? 0}`);
    console.log(`  postmarkUrl: ${sampleSend.postmarkUrl?.slice(0, 60)}…`);
  }

  const missing = themeNames.filter((n) => !sends.has(n));
  if (missing.length > 0) {
    console.log(`\n⚠️  ${missing.length} nombres no aparecen en blazer_query_401:`);
    for (const m of missing.slice(0, 5)) console.log(`  - ${m}`);
    if (missing.length > 5) console.log(`  … y ${missing.length - 5} más`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
