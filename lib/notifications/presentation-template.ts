/**
 * HTML template for the "presentación" PDF — la hoja que Kublau le manda
 * a HSBC MKT para revisión.
 *
 * Design intent (post-feedback round 2):
 *   - UNA sola hoja (letter), no un deck multi-página.
 *   - Layout de 2 columnas: a la IZQUIERDA la pieza (PNG hi-res del email
 *     dentro de un marco con sombra), a la DERECHA los textos de Asunto,
 *     Preheader y SMS.
 *   - El texto se muestra como RESULTADO FINAL: el markdown `**negritas**`
 *     se convierte a <strong> real, nunca se ven los asteriscos crudos.
 *
 * Puppeteer renderiza con margin:0 y el CSS controla padding/footer.
 */

import type { NotificationDraft } from "@/lib/adapters/supabase/notification-drafts";

const HSBC_RED = "#DB0011";
const INK = "#0F0F10";
const INK_MUTED = "#6B6B70";
const RULE = "#E6E6E8";

const TODAY = () =>
  new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/** HTML-escape for safe insertion as text content. */
function esc(s: string | undefined | null): string {
  if (!s) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Escapa el HTML y DESPUÉS convierte el markdown `**negritas**` en
 * <strong>. Es la MISMA regla que `applyMarkdownBold` del template del
 * email, para que el PDF muestre el resultado final (texto en negritas)
 * y nunca los asteriscos crudos. Los `*` no se escapan, así que la regex
 * sigue funcionando después de `esc`.
 */
function escBold(s: string | undefined | null): string {
  return esc(s).replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>");
}

/** id interno → label humano para el deck. */
const LABELS: Record<string, string> = {
  // objectives
  activar: "Activar",
  verificar: "Verificar",
  informar: "Informar",
  recordar: "Recordar",
  agradecer: "Agradecer",
  bienvenida: "Dar bienvenida",
  // audiences
  todos: "Todos los tarjetahabientes",
  nuevos: "Nuevos tarjetahabientes",
  recurrentes: "Clientes recurrentes",
  vip: "VIP / Premier",
  morosos: "Clientes con adeudo",
  // urgencies
  baja: "Baja",
  media: "Media",
  alta: "Alta",
  // tones
  informativo: "Informativo",
  cercano: "Cercano",
  celebratorio: "Celebratorio",
  urgente: "Urgente",
  formal: "Formal",
  // products
  viva: "VIVA",
  vivaplus: "VIVA Plus",
  "2now": "2Now",
  advance: "Advance",
  air: "Air",
  premier: "Premier",
  clasica: "Clásica",
  zero: "Zero",
};
const label = (id: string | undefined): string => (id ? (LABELS[id] ?? id) : "—");

export function buildPresentationHtml(args: {
  draft: NotificationDraft;
  emailHtml: string;
  emailPngDataUrl: string;
}): string {
  const { draft, emailPngDataUrl } = args;
  const { brief, copy } = draft;
  const date = TODAY();
  const projectName = draft.name?.trim() || "Notificación sin nombre";
  const productLabel = label(brief.product);
  const smsLen = (copy.sms ?? "").length;

  // ─────────────────── CSS ───────────────────
  const css = `
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; }
    /* Hide Chrome's viewport scrollbar — sin esto Chrome dibuja una barra
       vertical que termina horneada en el PDF. */
    ::-webkit-scrollbar { display: none; width: 0; height: 0; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
      color: ${INK};
      background: #FFFFFF;
      overflow: hidden;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      scrollbar-width: none;
    }
    .page {
      width: 8.5in;
      height: 11in;
      padding: 0.9in 0.8in 0.8in 0.85in;
      position: relative;
      overflow: hidden;
    }

    /* Barra roja vertical en el borde izquierdo. */
    .side-accent {
      position: absolute;
      top: 0; bottom: 0; left: 0;
      width: 6px;
      background: ${HSBC_RED};
    }
    .page-header {
      position: absolute;
      top: 0.45in;
      left: 0.85in;
      right: 0.8in;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8.5pt;
      color: ${INK_MUTED};
      letter-spacing: 0.18em;
      text-transform: uppercase;
      font-weight: 600;
    }
    .page-header .brand { color: ${INK}; }
    .page-footer {
      position: absolute;
      bottom: 0.45in;
      left: 0.85in;
      right: 0.8in;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 8pt;
      color: ${INK_MUTED};
      letter-spacing: 0.04em;
    }

    /* ───── Encabezado de la hoja ───── */
    .deck-head { margin-bottom: 22pt; }
    .deck-head .eyebrow {
      font-size: 9pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
      margin-bottom: 8pt;
    }
    .deck-head h1 {
      font-size: 19pt;
      font-weight: 800;
      letter-spacing: -0.015em;
      line-height: 1.05;
      margin: 0;
      color: ${INK};
    }
    .deck-head .meta {
      margin-top: 8pt;
      font-size: 10pt;
      color: ${INK_MUTED};
      font-weight: 500;
    }
    .deck-head .meta strong { color: ${INK}; font-weight: 700; }

    /* ───── Dos columnas: pieza | info ───── */
    .two-col {
      display: flex;
      gap: 30pt;
      align-items: flex-start;
    }
    .col-piece { flex: 0 0 auto; }
    .piece-frame {
      display: inline-block;
      background: white;
      border-radius: 10pt;
      overflow: hidden;
      border: 1px solid ${RULE};
      box-shadow:
        0 1pt 2pt rgba(0,0,0,0.06),
        0 16pt 34pt -18pt rgba(0,0,0,0.20);
    }
    .piece-frame img {
      display: block;
      max-width: 3.5in;
      max-height: 7.7in;
      width: auto;
      height: auto;
    }
    .piece-caption {
      font-size: 8pt;
      color: ${INK_MUTED};
      margin-top: 9pt;
      max-width: 3.5in;
      letter-spacing: 0.02em;
    }

    .col-info { flex: 1; min-width: 0; }
    .info-field + .info-field {
      margin-top: 22pt;
      padding-top: 22pt;
      border-top: 1px solid ${RULE};
    }
    .info-field .k {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
    }
    .info-field .v {
      font-size: 13pt;
      line-height: 1.5;
      color: ${INK};
      margin-top: 9pt;
      font-weight: 500;
    }
    .info-field .v.lg { font-size: 15pt; line-height: 1.4; }
    .info-field .v strong { font-weight: 800; color: ${INK}; }
    .info-field .count {
      font-size: 9pt;
      color: ${INK_MUTED};
      margin-top: 8pt;
      font-variant-numeric: tabular-nums;
    }
    .info-field .count.over { color: ${HSBC_RED}; font-weight: 700; }
  `;

  // ─────────────────── render ───────────────────
  const headerBar = `
    <div class="side-accent"></div>
    <div class="page-header">
      <div>Propuesta de notificación</div>
    </div>`;

  const footerBar = `
    <div class="page-footer">
      <div>${esc(projectName)} · ${esc(date)}</div>
      <div>Confidencial · Para revisión HSBC</div>
    </div>`;

  const page = `
    <section class="page">
      ${headerBar}

      <div class="deck-head">
        <div class="eyebrow">Pieza HSBC ${esc(productLabel)}</div>
        <h1>${esc(projectName)}</h1>
      </div>

      <div class="two-col">
        <div class="col-piece">
          <div class="piece-frame">
            <img src="${emailPngDataUrl}" alt="Render del email" />
          </div>
        </div>

        <div class="col-info">
          <div class="info-field">
            <div class="k">Asunto</div>
            <div class="v lg">${escBold(copy.subject) || "—"}</div>
          </div>
          <div class="info-field">
            <div class="k">Preheader</div>
            <div class="v">${escBold(copy.preheader) || "—"}</div>
          </div>
          <div class="info-field">
            <div class="k">SMS</div>
            <div class="v">${escBold(copy.sms) || "—"}</div>
            <div class="count${smsLen > 160 ? " over" : ""}">${smsLen} / 160 caracteres</div>
          </div>
        </div>
      </div>

      ${footerBar}
    </section>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(projectName)} — Propuesta HSBC</title>
  <style>${css}</style>
</head>
<body>
  ${page}
</body>
</html>`;
}
