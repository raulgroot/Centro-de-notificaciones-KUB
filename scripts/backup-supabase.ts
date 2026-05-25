/**
 * Backup manual de la base de datos Supabase a un archivo `.sql` local.
 *
 * Supabase free tier mantiene backups automáticos de los últimos 7 días en
 * su lado, pero:
 *   1. No están en TU compu (lock-in y dependencia de su uptime)
 *   2. Después de 7 días, se pierden
 *   3. Si pierdes acceso a la cuenta, adiós data
 *
 * Este script hace `pg_dump` directo a un archivo timestamp en `./backups/`.
 * Pensado para correrse antes de migraciones grandes o periódicamente
 * (semanal/mensual según riesgo).
 *
 * Uso:
 *   pnpm backup:db
 *
 * Restauración:
 *   psql "$DATABASE_URL" < backups/backup-YYYY-MM-DD-HHMMSS.sql
 *   (ver docs/operations/restore-from-backup.md para el procedimiento completo)
 *
 * Prerequisitos:
 *   - `pg_dump` instalado (`brew install postgresql@16` en macOS)
 *   - `DATABASE_URL` en `.env.local` apuntando a Supabase
 */

import { execSync } from "node:child_process";
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const BACKUP_DIR = "backups";

function timestamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ Falta DATABASE_URL en el entorno. Cárgalo desde .env.local.");
    process.exit(1);
  }

  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  const filename = `backup-${timestamp()}.sql`;
  const outPath = join(BACKUP_DIR, filename);

  console.log(`→ Dumping a ${outPath}…`);

  try {
    // -F p = plain SQL (más fácil de inspeccionar/diff que el formato custom)
    // --no-owner --no-privileges = portable entre cuentas
    // --clean --if-exists = el restore puede correrse sobre una DB con esquema
    execSync(
      `pg_dump "${databaseUrl}" -F p --no-owner --no-privileges --clean --if-exists --file="${outPath}"`,
      { stdio: "inherit" },
    );

    // Tamaño del archivo para confirmar que sí dumpeó algo
    const stats = execSync(`du -h "${outPath}"`).toString().split(/\s+/)[0];
    console.log(`\n✅ Backup completo: ${outPath} (${stats})`);
    console.log("\nPara restaurar:");
    console.log(`  psql "$DATABASE_URL" < ${outPath}`);
    console.log("\n⚠️  El archivo NO se commitea (está en .gitignore).");
    console.log("    Súbelo a iCloud / Drive / S3 si quieres respaldo off-site.");
  } catch (e) {
    console.error("❌ pg_dump falló:", e instanceof Error ? e.message : e);
    console.error("\n¿Tienes pg_dump instalado?");
    console.error("  brew install postgresql@16  (macOS)");
    process.exit(1);
  }
}

main();
