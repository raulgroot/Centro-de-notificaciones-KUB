/**
 * Sanitiza el HTML de los flujos (`flow_steps.mockup_html` y los items de
 * `flows.rules`) antes de inyectarlo con dangerouslySetInnerHTML.
 *
 * Hoy ese HTML solo se edita por SQL y está limpio, pero la página lo inyecta
 * tal cual: un registro malo en la BD sería XSS almacenado para todo el
 * equipo. Allowlist, no blocklist:
 *
 *   - Etiqueta permitida → se queda, sin atributos `on*` ni `srcdoc`, y sin
 *     URLs `javascript:` / `vbscript:` / `data:` que no sean imagen.
 *   - Etiqueta peligrosa (script, iframe, style…) → se borra CON contenido.
 *   - Cualquier otra → se desenvuelve (se conserva el texto, se va la tag).
 *
 * Las allowlists son exactamente las etiquetas que usan los mockups y reglas
 * actuales (sep-2026), así la fidelidad visual no cambia. Pure function.
 */

import { load } from "cheerio";

const MOCKUP_TAGS = new Set([
  "div",
  "span",
  "p",
  "strong",
  "b",
  "em",
  "i",
  "br",
  "ul",
  "ol",
  "li",
  "img",
  "button",
  "input",
  "textarea",
  "label",
  "a",
  "h1",
  "h2",
  "h3",
  "h4",
  "small",
  "svg",
  "g",
  "rect",
  "path",
  "circle",
  "polygon",
  "polyline",
  "line",
  "ellipse",
]);

const RULE_TAGS = new Set(["strong", "b", "em", "i", "br", "code"]);

/** Se borran con todo y contenido (no tiene sentido rescatar su texto). */
const DROP_WITH_CONTENT = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "template",
  "noscript",
  "link",
  "meta",
  "base",
  "form",
  "foreignobject",
]);

const URL_ATTRS = new Set(["href", "src", "xlink:href", "action", "formaction", "poster"]);
const UNSAFE_URL = /^\s*(javascript|vbscript):|^\s*data:(?!image\/)/i;

function sanitize(html: string, allowed: Set<string>): string {
  const $ = load(html, null, false);
  $("*").each((_i, el) => {
    // OJO: no filtrar por el.type === "tag" — domhandler marca <script> y
    // <style> con type "script"/"style", y son justo los que hay que borrar.
    // `"tagName" in el` cubre los tres tipos de elemento y descarta texto.
    if (!("tagName" in el)) return;
    const tag = el.tagName.toLowerCase();
    if (DROP_WITH_CONTENT.has(tag)) {
      $(el).remove();
      return;
    }
    if (!allowed.has(tag)) {
      $(el).replaceWith($(el).contents());
      return;
    }
    for (const name of Object.keys(el.attribs)) {
      const n = name.toLowerCase();
      if (n.startsWith("on") || n === "srcdoc") $(el).removeAttr(name);
      else if (URL_ATTRS.has(n) && UNSAFE_URL.test(el.attribs[name] ?? "")) $(el).removeAttr(name);
    }
  });
  return $.html();
}

/** Mockups de pantalla: HTML + SVG de la UI real que se documenta. */
export function sanitizeMockupHtml(html: string): string {
  return sanitize(html, MOCKUP_TAGS);
}

/** Items de reglas: texto con énfasis inline, nada más. */
export function sanitizeRuleHtml(html: string): string {
  return sanitize(html, RULE_TAGS);
}
