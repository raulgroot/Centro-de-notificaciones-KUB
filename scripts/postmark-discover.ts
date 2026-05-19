#!/usr/bin/env tsx
/**
 * scripts/postmark-discover.ts
 *
 * Discovery one-shot: confirma que la API key funciona, muestra info del
 * server, lista los últimos 25 envíos, y resume stats de los últimos 7 días.
 *
 * Lo que necesito ver para construir el cruce con el catálogo de Kublau:
 *   1. ¿Qué nombre tiene el server? (sanity)
 *   2. ¿Los messages traen `Tag`? ¿Qué patrones usan?
 *   3. ¿`MessageStream` separa broadcast vs transaccional?
 *   4. ¿Los `Subject` matchean nombres de notificación del catálogo?
 *   5. ¿Hay tracking de opens/clicks activo?
 *
 * Uso:
 *   pnpm postmark:discover
 *
 * Requiere POSTMARK_API_KEY en .env.local. Si la key vive en Vercel:
 *   vercel env pull .env.local
 */

import {
  getOutboundStats,
  getServerInfo,
  listOutboundMessages,
} from "@/lib/adapters/postmark/client";

function fmt(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19);
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  // 1. Server info -- sanity check.
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  POSTMARK · Sanity check");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const server = await getServerInfo();
  console.log(`  Server ID:    ${server.id}`);
  console.log(`  Server name:  ${server.name}`);
  console.log(`  Server link:  ${server.serverLink}`);
  if (server.color) console.log(`  Color:        ${server.color}`);

  // 2. Recent outbound -- last 25 messages.
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Últimos 25 mensajes outbound");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const { messages, totalCount } = await listOutboundMessages({ count: 25 });
  console.log(`  Total en el server: ${totalCount.toLocaleString("en-US")}`);
  console.log();
  for (const m of messages) {
    const tag = m.tag ?? "—";
    const stream = m.messageStream ?? "—";
    const to = m.to[0]?.email ?? "—";
    console.log(`  ${fmt(m.receivedAt)}  [${m.status.padEnd(8)}]`);
    console.log(`    To:      ${to}`);
    console.log(`    Subject: ${m.subject.slice(0, 80)}`);
    console.log(`    Tag:     ${tag}`);
    console.log(`    Stream:  ${stream}`);
    console.log(`    Tracks:  opens=${m.trackOpens} links=${m.trackLinks}`);
    console.log();
  }

  // 3. Tag inventory -- group recent messages by tag so we can see HSBC's taxonomy.
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Tags vistos en los últimos 25");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const tagCounts = new Map<string, number>();
  for (const m of messages) {
    const tag = m.tag ?? "(sin tag)";
    tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
  }
  const sorted = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]);
  for (const [tag, count] of sorted) {
    console.log(`  ${String(count).padStart(3)}  ${tag}`);
  }

  // 4. Aggregate stats for the last 7 days.
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Stats últimos 7 días (todo el server)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const stats = await getOutboundStats({
    fromDate: isoDate(weekAgo),
    toDate: isoDate(now),
  });
  console.log(`  Sent:           ${stats.sent.toLocaleString("en-US")}`);
  console.log(`  Bounced:        ${stats.bounced}`);
  console.log(`  SMTP errors:    ${stats.smtpApiErrors}`);
  console.log(`  Spam complaints:${stats.spamComplaints}`);
  console.log(`  Unique opens:   ${stats.uniqueOpens ?? "(tracking off / no data)"}`);
  console.log(`  Total opens:    ${stats.totalOpens ?? "(tracking off / no data)"}`);
  console.log(`  Unique clicks:  ${stats.uniqueClicks ?? "(tracking off / no data)"}`);
  console.log(`  Total clicks:   ${stats.totalClicks ?? "(tracking off / no data)"}`);

  console.log("\n  ✓ Discovery completo. Mándame este output y aterrizamos");
  console.log("    cómo enlazar Postmark con el catálogo de Kublau.\n");
}

main().catch((err) => {
  console.error("\n  ✗ Error:", err.message ?? err);
  process.exit(1);
});
