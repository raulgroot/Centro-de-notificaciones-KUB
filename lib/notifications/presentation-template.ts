/**
 * HTML template for the "presentación" PDF — the version Kublau hands off
 * to HSBC MKT for review.
 *
 * Structure (one <section class="page"> per PDF page):
 *   1. Cover            — project name, fecha, producto, draft id
 *   2. Brief            — objetivo, audiencia, urgencia, tono, tema, datos
 *   3. Asunto+preheader — inbox-row mockup + textos completos
 *   4. Pieza de email   — el render real centrado
 *   5. SMS              — mockup iPhone-style + texto completo
 *
 * Each page is a fixed-size letter portrait (8.5×11in) styled to look like
 * a print deck. Puppeteer renders this with `margin: 0` and the page CSS
 * does the padding so we control footer/accent placement.
 *
 * The email body is inlined (not iframed) so Chrome can paginate naturally
 * if the email exceeds one page. Inline styles from the email template are
 * preserved as-is (HSBC standard is inline anyway).
 */

import { load } from "cheerio";
import type { NotificationDraft } from "@/lib/adapters/supabase/notification-drafts";

const HSBC_RED = "#DB0011";
const TODAY = () =>
  new Date().toLocaleDateString("es-MX", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

/** Strip <html><head><body> wrappers and return just the body's inner HTML. */
function extractEmailBody(emailHtml: string): { body: string; styles: string } {
  const $ = load(emailHtml);
  const body = $("body").html() ?? "";
  const styles = $("style")
    .map((_i, el) => $(el).html() ?? "")
    .get()
    .join("\n");
  return { body, styles };
}

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

/** Convert internal id ("activar", "vip"…) to a human label for the deck. */
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
  // products (uppercase for display)
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
}): string {
  const { draft, emailHtml } = args;
  const { brief, copy } = draft;
  const { body: emailBody, styles: emailStyles } = extractEmailBody(emailHtml);
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
      font-family: 'Helvetica Neue', 'Helvetica', Arial, sans-serif;
      color: #1A1A1A;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .page {
      width: 8.5in;
      height: 11in;
      padding: 0.85in 0.85in 0.7in 0.85in;
      position: relative;
      page-break-after: always;
      overflow: hidden;
    }
    .page:last-child { page-break-after: auto; }
    .accent-bar {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 8px;
      background: ${HSBC_RED};
    }
    .page-header {
      position: absolute;
      top: 0.45in;
      left: 0.85in;
      right: 0.85in;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9pt;
      color: #888;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .page-header .brand { font-weight: 700; color: #1A1A1A; }
    .page-footer {
      position: absolute;
      bottom: 0.45in;
      left: 0.85in;
      right: 0.85in;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 8pt;
      color: #B0B0B0;
    }
    h1.section-title {
      font-size: 26pt;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin: 0 0 6px 0;
      color: #1A1A1A;
    }
    .section-eyebrow {
      font-size: 10pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
      margin-bottom: 12px;
    }
    .section-hint {
      font-size: 11pt;
      color: #6B6B6B;
      margin: 0 0 28px 0;
      line-height: 1.45;
    }

    /* ───── Cover ───── */
    .cover {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .cover .cover-top {}
    .cover h1.cover-title {
      font-size: 44pt;
      font-weight: 800;
      letter-spacing: -0.02em;
      line-height: 1.05;
      color: #1A1A1A;
      margin: 28px 0 0 0;
    }
    .cover .cover-meta {
      margin-top: 64px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px 32px;
    }
    .cover .meta-item .meta-label {
      font-size: 8pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #888;
      font-weight: 700;
    }
    .cover .meta-item .meta-value {
      font-size: 14pt;
      font-weight: 600;
      color: #1A1A1A;
      margin-top: 4px;
    }
    .cover .cover-bottom {
      border-top: 2px solid #1A1A1A;
      padding-top: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .cover .cover-bottom .confidential {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #888;
    }

    /* ───── Brief ───── */
    .brief-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 18px;
      margin-bottom: 28px;
    }
    .brief-card {
      border: 1px solid #E5E5E5;
      border-radius: 10px;
      padding: 14px 16px;
    }
    .brief-card .k {
      font-size: 8pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #888;
      font-weight: 700;
    }
    .brief-card .v {
      font-size: 14pt;
      font-weight: 600;
      color: #1A1A1A;
      margin-top: 4px;
    }
    .brief-block {
      margin-top: 12px;
    }
    .brief-block .k {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
      margin-bottom: 8px;
    }
    .brief-block .v {
      font-size: 12pt;
      line-height: 1.55;
      color: #2B2B2B;
      white-space: pre-wrap;
    }

    /* ───── Asunto + preheader ───── */
    .inbox-row {
      border: 1px solid #E5E5E5;
      border-radius: 10px;
      padding: 16px 18px;
      background: #FAFAFA;
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .inbox-row .inbox-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: ${HSBC_RED};
      color: white;
      font-size: 12pt;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .inbox-row .inbox-content { flex: 1; min-width: 0; }
    .inbox-row .inbox-sender { font-size: 11pt; font-weight: 700; color: #1A1A1A; }
    .inbox-row .inbox-subject { font-size: 11pt; font-weight: 600; color: #1A1A1A; margin-top: 2px; }
    .inbox-row .inbox-preheader { font-size: 10pt; color: #888; margin-top: 2px; }
    .field-block {
      margin-top: 22px;
      padding: 14px 16px;
      border: 1px solid #E5E5E5;
      border-radius: 10px;
    }
    .field-block .k {
      font-size: 9pt;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: ${HSBC_RED};
      font-weight: 700;
    }
    .field-block .v {
      font-size: 13pt;
      line-height: 1.5;
      color: #1A1A1A;
      margin-top: 6px;
    }

    /* ───── Pieza de email ───── */
    .email-stage {
      display: flex;
      justify-content: center;
      padding-top: 8px;
    }
    .email-stage .email-frame {
      width: 600px;
      max-width: 100%;
      background: #F7F7F7;
      padding: 12px;
      border-radius: 12px;
      border: 1px solid #E5E5E5;
    }
    .email-stage .email-frame .inner {
      background: #FFFFFF;
      border-radius: 6px;
      overflow: hidden;
    }

    /* ───── SMS ───── */
    .sms-stage {
      display: flex;
      gap: 36px;
      align-items: flex-start;
      margin-top: 18px;
    }
    .phone {
      width: 240px;
      height: 480px;
      border: 8px solid #1A1A1A;
      border-radius: 36px;
      background: #FFFFFF;
      position: relative;
      flex-shrink: 0;
      box-shadow: 0 6px 30px rgba(0,0,0,0.12);
    }
    .phone .phone-top {
      height: 48px;
      background: #F4F4F6;
      border-top-left-radius: 28px;
      border-top-right-radius: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 10pt;
      font-weight: 700;
      color: #1A1A1A;
      border-bottom: 1px solid #E5E5E7;
    }
    .phone .phone-body {
      padding: 18px 14px;
    }
    .phone .sms-bubble {
      background: #E5E5EA;
      color: #1A1A1A;
      padding: 10px 14px;
      border-radius: 16px;
      border-bottom-left-radius: 4px;
      font-size: 10pt;
      line-height: 1.4;
      max-width: 80%;
    }
    .phone .sms-sender {
      font-size: 8pt;
      color: #888;
      margin-bottom: 4px;
      margin-left: 4px;
      font-weight: 600;
    }
    .sms-info { flex: 1; }
    .sms-info .field-block { margin-top: 0; }
    .sms-info .sms-count {
      font-size: 9pt;
      color: #888;
      margin-top: 6px;
      font-variant-numeric: tabular-nums;
    }
  `;

  // ─────────────────── Helpers para secciones ───────────────────
  const briefCard = (k: string, v: string) =>
    `<div class="brief-card"><div class="k">${esc(k)}</div><div class="v">${esc(v) || "—"}</div></div>`;

  const pageHeader = (subtitle: string) => `
    <div class="accent-bar"></div>
    <div class="page-header">
      <div class="brand">KUBLAU × HSBC</div>
      <div>${esc(subtitle)}</div>
    </div>`;

  const pageFooter = (idx: number, total: number) => `
    <div class="page-footer">
      <div>Propuesta de comunicación · ${esc(date)}</div>
      <div>${idx} / ${total}</div>
    </div>`;

  const TOTAL_PAGES = 5;

  // ─────────────────── Pages ───────────────────
  const coverPage = `
    <section class="page cover">
      ${pageHeader("Cover")}
      <div class="cover-top" style="margin-top:0.6in;">
        <div class="section-eyebrow">Propuesta de notificación</div>
        <h1 class="cover-title">${esc(projectName)}</h1>
        <div class="cover-meta">
          <div class="meta-item">
            <div class="meta-label">Producto</div>
            <div class="meta-value">HSBC ${esc(productLabel)}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Audiencia</div>
            <div class="meta-value">${esc(label(brief.audience))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Objetivo</div>
            <div class="meta-value">${esc(label(brief.objective))}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Fecha</div>
            <div class="meta-value">${esc(date)}</div>
          </div>
        </div>
      </div>
      <div class="cover-bottom">
        <div class="confidential">Confidencial · Para revisión interna HSBC</div>
        <div style="font-size:9pt;color:#888;">v1.0</div>
      </div>
      ${pageFooter(1, TOTAL_PAGES)}
    </section>`;

  const briefPage = `
    <section class="page">
      ${pageHeader("Brief")}
      <div class="section-eyebrow">01 · Brief</div>
      <h1 class="section-title">Resumen del brief</h1>
      <p class="section-hint">Los parámetros que recibimos para construir esta pieza.</p>
      <div class="brief-grid">
        ${briefCard("Producto", `HSBC ${productLabel}`)}
        ${briefCard("Objetivo", label(brief.objective))}
        ${briefCard("Audiencia", label(brief.audience))}
        ${briefCard("Urgencia", label(brief.urgency))}
        ${briefCard("Tono", label(brief.tone))}
        ${briefCard("Fecha", date)}
      </div>
      ${
        brief.topic
          ? `
        <div class="brief-block">
          <div class="k">De qué se trata</div>
          <div class="v">${esc(brief.topic)}</div>
        </div>`
          : ""
      }
      ${
        brief.keyInfo
          ? `
        <div class="brief-block">
          <div class="k">Información clave</div>
          <div class="v">${esc(brief.keyInfo)}</div>
        </div>`
          : ""
      }
      ${pageFooter(2, TOTAL_PAGES)}
    </section>`;

  const subjectPage = `
    <section class="page">
      ${pageHeader("Asunto · Preheader")}
      <div class="section-eyebrow">02 · Bandeja</div>
      <h1 class="section-title">Asunto y preheader</h1>
      <p class="section-hint">Lo primero que ve el cliente cuando llega el correo.</p>
      <div class="inbox-row">
        <div class="inbox-avatar">H</div>
        <div class="inbox-content">
          <div class="inbox-sender">HSBC México</div>
          <div class="inbox-subject">${esc(copy.subject)}</div>
          <div class="inbox-preheader">${esc(copy.preheader)}</div>
        </div>
      </div>
      <div class="field-block">
        <div class="k">Asunto</div>
        <div class="v">${esc(copy.subject) || "—"}</div>
      </div>
      <div class="field-block">
        <div class="k">Preheader</div>
        <div class="v">${esc(copy.preheader) || "—"}</div>
      </div>
      ${pageFooter(3, TOTAL_PAGES)}
    </section>`;

  const piecePage = `
    <section class="page">
      ${pageHeader("Pieza de email")}
      <div class="section-eyebrow">03 · Pieza</div>
      <h1 class="section-title">Email</h1>
      <p class="section-hint">Render real con base en la plantilla MKT-aprobada de HSBC.</p>
      <div class="email-stage">
        <div class="email-frame">
          <div class="inner">
            ${emailBody}
          </div>
        </div>
      </div>
      ${pageFooter(4, TOTAL_PAGES)}
    </section>`;

  const smsPage = `
    <section class="page">
      ${pageHeader("SMS")}
      <div class="section-eyebrow">04 · SMS</div>
      <h1 class="section-title">Mensaje SMS</h1>
      <p class="section-hint">Versión móvil — máximo 160 caracteres, centrada en el call-to-action.</p>
      <div class="sms-stage">
        <div class="phone">
          <div class="phone-top">HSBC</div>
          <div class="phone-body">
            <div class="sms-sender">HSBC</div>
            <div class="sms-bubble">${esc(copy.sms) || "—"}</div>
          </div>
        </div>
        <div class="sms-info">
          <div class="field-block">
            <div class="k">Texto completo</div>
            <div class="v">${esc(copy.sms) || "—"}</div>
            <div class="sms-count">${(copy.sms ?? "").length} / 160 caracteres</div>
          </div>
        </div>
      </div>
      ${pageFooter(5, TOTAL_PAGES)}
    </section>`;

  // ─────────────────── Final document ───────────────────
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${esc(projectName)} — Propuesta HSBC</title>
  <style>${css}</style>
  <style>${emailStyles}</style>
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
