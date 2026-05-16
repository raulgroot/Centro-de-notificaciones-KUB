/**
 * HTML template for the "presentación" PDF — el deck que Kublau le manda
 * a HSBC MKT para revisión.
 *
 * Design intent (post-feedback round 1):
 *   - Editorial vibe, no "form-with-cards"
 *   - Type-led hierarchy: jumbo titles, generous breathing room
 *   - One focal point per page; metadata as quiet supporting text
 *   - The pieza page embebe el email como IMAGEN (PNG hi-res) dentro de
 *     un marco con sombra. Esto evita el reflow raro que pasaba cuando
 *     metíamos el HTML del email crudo en una página letter.
 *
 * Structure (5 páginas):
 *   1. Cover            — proyecto, producto, fecha, accent bar lateral
 *   2. Brief            — el resumen editorial de los parámetros
 *   3. Asunto+preheader — bandeja mockup + textos completos
 *   4. Pieza            — PNG del email centrado, marco + sombra
 *   5. SMS              — iPhone mockup + texto completo
 *
 * Puppeteer renderiza con margin:0 y el CSS controla padding/footer.
 */

import type { NotificationDraft } from "@/lib/adapters/supabase/notification-drafts";

const HSBC_RED = "#DB0011";
const INK = "#0F0F10";
const INK_MUTED = "#6B6B70";
const RULE = "#E6E6E8";
const BG_SOFT = "#F7F7F8";

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

  // ─────────────────── CSS ───────────────────
  const css = `
    @page { size: letter; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Helvetica Neue', Arial, sans-serif;
      color: ${INK};
      background: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 8.5in;
      height: 11in;
      padding: 0.9in 0.9in 0.85in 0.9in;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }

    /* Side accent bar — vertical red strip on left edge of every page. */
    .side-accent {
      position: absolute;
      top: 0; bottom: 0; left: 0;
      width: 6px;
      background: ${HSBC_RED};
    }
    .page-header {
      position: absolute;
      top: 0.5in;
      left: 0.9in;
      right: 0.9in;
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
      bottom: 0.5in;
      left: 0.9in;
      right: 0.9in;
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      font-size: 8pt;
      color: ${INK_MUTED};
      letter-spacing: 0.04em;
    }
    .page-num {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
      color: ${INK};
    }

    .eyebrow {
      font-size: 9pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
      margin-bottom: 14px;
    }
    h1.title {
      font-size: 36pt;
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.02;
      margin: 0 0 14px 0;
      color: ${INK};
    }
    p.lede {
      font-size: 13pt;
      line-height: 1.45;
      color: ${INK_MUTED};
      max-width: 520pt;
      margin: 0 0 36px 0;
    }

    /* ───── Cover ───── */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover .stage { margin-top: 1.2in; }
    .cover h1.cover-title {
      font-size: 56pt;
      font-weight: 800;
      letter-spacing: -0.035em;
      line-height: 0.98;
      color: ${INK};
      margin: 18px 0 0 0;
    }
    .cover .cover-meta {
      margin-top: 56pt;
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 22pt 36pt;
      max-width: 480pt;
    }
    .cover .meta-row .meta-key {
      font-size: 8pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${INK_MUTED};
      font-weight: 700;
    }
    .cover .meta-row .meta-value {
      font-size: 14pt;
      font-weight: 600;
      color: ${INK};
      margin-top: 4px;
    }
    .cover .cover-bottom {
      border-top: 1px solid ${RULE};
      padding-top: 14px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .cover .confidential {
      font-size: 8.5pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${INK_MUTED};
      font-weight: 600;
    }
    .cover .version {
      font-size: 8.5pt;
      color: ${INK_MUTED};
      font-variant-numeric: tabular-nums;
    }

    /* ───── Brief — editorial ───── */
    .brief-list { margin-top: 8px; }
    .brief-row {
      display: grid;
      grid-template-columns: 140pt 1fr;
      align-items: baseline;
      padding: 14pt 0;
      border-bottom: 1px solid ${RULE};
    }
    .brief-row .k {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${INK_MUTED};
      font-weight: 700;
    }
    .brief-row .v {
      font-size: 14pt;
      color: ${INK};
      font-weight: 500;
    }
    .brief-narrative {
      margin-top: 32pt;
    }
    .brief-narrative .label {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
      margin-bottom: 8pt;
    }
    .brief-narrative .body {
      font-size: 13pt;
      line-height: 1.55;
      color: ${INK};
      white-space: pre-wrap;
    }
    .brief-narrative + .brief-narrative { margin-top: 22pt; }

    /* ───── Asunto + preheader ───── */
    .inbox {
      border: 1px solid ${RULE};
      border-radius: 12pt;
      padding: 18pt 20pt;
      background: ${BG_SOFT};
      display: flex;
      gap: 14pt;
      align-items: flex-start;
      box-shadow: 0 4pt 14pt -8pt rgba(0,0,0,0.15);
    }
    .inbox .avatar {
      width: 40pt; height: 40pt;
      border-radius: 50%;
      background: ${HSBC_RED};
      color: white;
      font-size: 14pt;
      font-weight: 800;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .inbox .lines { flex: 1; min-width: 0; }
    .inbox .sender { font-size: 10pt; font-weight: 700; color: ${INK}; letter-spacing: 0.02em; }
    .inbox .subject { font-size: 11pt; font-weight: 600; color: ${INK}; margin-top: 3pt; line-height: 1.3; }
    .inbox .preheader { font-size: 9.5pt; color: ${INK_MUTED}; margin-top: 3pt; line-height: 1.35; }
    .field {
      margin-top: 28pt;
    }
    .field .k {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
    }
    .field .v {
      font-size: 14pt;
      line-height: 1.45;
      color: ${INK};
      margin-top: 8pt;
      font-weight: 500;
    }

    /* ───── Pieza ───── */
    .piece-stage {
      display: flex;
      justify-content: center;
      margin-top: 14pt;
    }
    .piece-frame {
      max-width: 460pt;
      width: 100%;
      background: white;
      border-radius: 10pt;
      box-shadow:
        0 1pt 2pt rgba(0,0,0,0.06),
        0 18pt 36pt -16pt rgba(0,0,0,0.18);
      overflow: hidden;
      border: 1px solid ${RULE};
    }
    .piece-frame img {
      display: block;
      width: 100%;
      height: auto;
    }
    .piece-caption {
      text-align: center;
      font-size: 9pt;
      color: ${INK_MUTED};
      margin-top: 18pt;
      letter-spacing: 0.02em;
    }

    /* ───── SMS ───── */
    .sms-stage {
      display: flex;
      gap: 40pt;
      align-items: flex-start;
      margin-top: 18pt;
    }
    .phone {
      width: 220pt;
      height: 440pt;
      border: 6pt solid #1A1A1B;
      border-radius: 36pt;
      background: #FFFFFF;
      position: relative;
      flex-shrink: 0;
      box-shadow:
        0 4pt 8pt rgba(0,0,0,0.08),
        0 24pt 48pt -20pt rgba(0,0,0,0.25);
    }
    .phone .notch {
      position: absolute;
      top: 8pt;
      left: 50%;
      transform: translateX(-50%);
      width: 90pt;
      height: 18pt;
      background: #1A1A1B;
      border-radius: 9pt;
    }
    .phone .status-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14pt 22pt 0 22pt;
      font-size: 8pt;
      font-weight: 700;
      color: ${INK};
    }
    .phone .header-row {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16pt 0 12pt 0;
      border-bottom: 0.5pt solid #E8E8EA;
    }
    .phone .header-row .avatar-small {
      width: 38pt; height: 38pt;
      border-radius: 50%;
      background: ${HSBC_RED};
      color: white;
      font-size: 13pt;
      font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 5pt;
    }
    .phone .header-row .name { font-size: 9pt; font-weight: 600; color: ${INK}; }
    .phone .messages { padding: 14pt 12pt; }
    .phone .bubble {
      background: #E9E9EB;
      color: ${INK};
      padding: 8pt 12pt;
      border-radius: 16pt;
      border-bottom-left-radius: 4pt;
      font-size: 9pt;
      line-height: 1.4;
      max-width: 84%;
    }
    .sms-info { flex: 1; }
    .sms-info .field { margin-top: 0; }
    .sms-info .count {
      font-size: 9pt;
      color: ${INK_MUTED};
      margin-top: 8pt;
      font-variant-numeric: tabular-nums;
    }
  `;

  // ─────────────────── helpers de render ───────────────────
  const pageHeader = (subtitle: string) => `
    <div class="side-accent"></div>
    <div class="page-header">
      <div class="brand">KUBLAU × HSBC</div>
      <div>${esc(subtitle)}</div>
    </div>`;

  const pageFooter = (idx: number, total: number, project: string) => `
    <div class="page-footer">
      <div>${esc(project)} · ${esc(date)}</div>
      <div class="page-num">${idx} / ${total}</div>
    </div>`;

  const briefRow = (k: string, v: string) => `
    <div class="brief-row">
      <div class="k">${esc(k)}</div>
      <div class="v">${esc(v) || "—"}</div>
    </div>`;

  const TOTAL_PAGES = 5;

  // ─────────────────── páginas ───────────────────
  const coverPage = `
    <section class="page cover">
      ${pageHeader("Cover")}
      <div class="stage">
        <div class="eyebrow">Propuesta de notificación</div>
        <h1 class="cover-title">${esc(projectName)}</h1>
        <div class="cover-meta">
          <div class="meta-row">
            <div class="meta-key">Producto</div>
            <div class="meta-value">HSBC ${esc(productLabel)}</div>
          </div>
          <div class="meta-row">
            <div class="meta-key">Audiencia</div>
            <div class="meta-value">${esc(label(brief.audience))}</div>
          </div>
          <div class="meta-row">
            <div class="meta-key">Objetivo</div>
            <div class="meta-value">${esc(label(brief.objective))}</div>
          </div>
          <div class="meta-row">
            <div class="meta-key">Fecha</div>
            <div class="meta-value">${esc(date)}</div>
          </div>
        </div>
      </div>
      <div class="cover-bottom">
        <div class="confidential">Confidencial · Para revisión HSBC</div>
        <div class="version">v1.0</div>
      </div>
      ${pageFooter(1, TOTAL_PAGES, projectName)}
    </section>`;

  const briefPage = `
    <section class="page">
      ${pageHeader("Brief")}
      <div style="margin-top:24pt;">
        <div class="eyebrow">01 · Brief</div>
        <h1 class="title">El brief</h1>
        <p class="lede">Los parámetros que recibimos del equipo HSBC para construir esta pieza.</p>
        <div class="brief-list">
          ${briefRow("Producto", `HSBC ${productLabel}`)}
          ${briefRow("Objetivo", label(brief.objective))}
          ${briefRow("Audiencia", label(brief.audience))}
          ${briefRow("Urgencia", label(brief.urgency))}
          ${briefRow("Tono", label(brief.tone))}
        </div>
        ${
          brief.topic
            ? `<div class="brief-narrative">
                <div class="label">De qué se trata</div>
                <div class="body">${esc(brief.topic)}</div>
              </div>`
            : ""
        }
        ${
          brief.keyInfo
            ? `<div class="brief-narrative">
                <div class="label">Información clave</div>
                <div class="body">${esc(brief.keyInfo)}</div>
              </div>`
            : ""
        }
      </div>
      ${pageFooter(2, TOTAL_PAGES, projectName)}
    </section>`;

  const subjectPage = `
    <section class="page">
      ${pageHeader("Bandeja")}
      <div style="margin-top:24pt;">
        <div class="eyebrow">02 · Bandeja</div>
        <h1 class="title">Asunto y preheader</h1>
        <p class="lede">Cómo se ve la pieza cuando llega a la bandeja del cliente, antes de abrir.</p>
        <div class="inbox">
          <div class="avatar">H</div>
          <div class="lines">
            <div class="sender">HSBC México</div>
            <div class="subject">${esc(copy.subject)}</div>
            <div class="preheader">${esc(copy.preheader)}</div>
          </div>
        </div>
        <div class="field">
          <div class="k">Asunto</div>
          <div class="v">${esc(copy.subject) || "—"}</div>
        </div>
        <div class="field">
          <div class="k">Preheader</div>
          <div class="v">${esc(copy.preheader) || "—"}</div>
        </div>
      </div>
      ${pageFooter(3, TOTAL_PAGES, projectName)}
    </section>`;

  const piecePage = `
    <section class="page">
      ${pageHeader("Pieza")}
      <div style="margin-top:24pt;">
        <div class="eyebrow">03 · Pieza</div>
        <h1 class="title">El email</h1>
        <p class="lede">Render real del email con base en la plantilla MKT-aprobada de HSBC.</p>
        <div class="piece-stage">
          <div class="piece-frame">
            <img src="${emailPngDataUrl}" alt="Render del email" />
          </div>
        </div>
        <div class="piece-caption">Captura a tamaño nativo del template (600 px). DPR 2× para nitidez.</div>
      </div>
      ${pageFooter(4, TOTAL_PAGES, projectName)}
    </section>`;

  const smsPage = `
    <section class="page">
      ${pageHeader("SMS")}
      <div style="margin-top:24pt;">
        <div class="eyebrow">04 · SMS</div>
        <h1 class="title">Mensaje SMS</h1>
        <p class="lede">Versión móvil — máximo 160 caracteres, centrada en el call-to-action.</p>
        <div class="sms-stage">
          <div class="phone">
            <div class="notch"></div>
            <div class="status-bar">
              <span>9:41</span>
              <span>•••</span>
            </div>
            <div class="header-row">
              <div class="avatar-small">H</div>
              <div class="name">HSBC</div>
            </div>
            <div class="messages">
              <div class="bubble">${esc(copy.sms) || "—"}</div>
            </div>
          </div>
          <div class="sms-info">
            <div class="field">
              <div class="k">Texto completo</div>
              <div class="v">${esc(copy.sms) || "—"}</div>
              <div class="count">${(copy.sms ?? "").length} / 160 caracteres</div>
            </div>
          </div>
        </div>
      </div>
      ${pageFooter(5, TOTAL_PAGES, projectName)}
    </section>`;

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(projectName)} — Propuesta HSBC</title>
  <style>${css}</style>
</head>
<body>
  ${coverPage}
  ${briefPage}
  ${subjectPage}
  ${piecePage}
  ${smsPage}
</body>
</html>`;
}
