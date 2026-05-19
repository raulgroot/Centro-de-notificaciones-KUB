/**
 * Sanitize an "última pieza enviada" HTML para mostrarla como preview
 * read-only sin riesgo de disparar el tracking de Postmark, los redirects
 * de Kublau, o un click accidental que arranque un flujo real del cliente.
 *
 * Reglas:
 *   - `<a href="...">` → quitamos el href (lo guardamos en data-original-href
 *     por si en algún momento querramos auditar a dónde apuntaba). Agregamos
 *     `cursor:not-allowed; pointer-events:none` para que ni siquiera reciba
 *     el hover/click visual.
 *   - `<form>` → removemos action y method para que un submit accidental no
 *     dispare nada.
 *   - `<button type="submit">` → cambiamos a type="button" por la misma razón.
 *   - Tracking pixels (`<img src="...open.gif">`) — los reemplazamos por
 *     un data URI transparente de 1×1 para que NO peguen al server cuando
 *     el iframe carga y registren un "open" falso.
 *
 * NOTA: el iframe va a ir sandboxed sin allow-scripts/allow-popups/
 * allow-top-navigation, lo cual ya bloquea la mayoría de escenarios — pero
 * esto es defensa en profundidad. Si alguien por error quita el sandbox,
 * el HTML sigue siendo inofensivo.
 */

import { load } from "cheerio";

/**
 * 1×1 transparent GIF en base64 (43 bytes). Reemplaza tracking pixels para
 * que el iframe no pegue al server de tracking cuando carga.
 */
const TRANSPARENT_PIXEL_DATA_URI =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Regex que detecta URLs típicas de tracking — Postmark, HSBC, opens. */
const TRACKING_URL_RE =
  /(open|track|pixel|beacon|impression)[/.]|pm-track\.com|mctrack|postmark.*\/open/i;

export function sanitizeForPreview(html: string): string {
  if (!html || html.trim() === "") return "";

  const $ = load(html, { xmlMode: false });

  // 1. Neutralize all anchor tags.
  $("a[href]").each((_i, el) => {
    const $a = $(el);
    const originalHref = $a.attr("href") ?? "";
    $a.attr("data-original-href", originalHref);
    $a.removeAttr("href");
    const existingStyle = $a.attr("style") ?? "";
    const sep = existingStyle && !existingStyle.endsWith(";") ? ";" : "";
    $a.attr("style", `${existingStyle}${sep}cursor:not-allowed;pointer-events:none;`);
  });

  // 2. Neutralize forms.
  $("form").each((_i, el) => {
    const $form = $(el);
    $form.attr("data-original-action", $form.attr("action") ?? "");
    $form.removeAttr("action").removeAttr("method");
  });
  $("button[type='submit'], input[type='submit']").each((_i, el) => {
    $(el).attr("type", "button");
  });

  // 3. Replace likely tracking pixels with a transparent data URI so el
  //    iframe no pegue a los servers de tracking al hacer load.
  $("img").each((_i, el) => {
    const $img = $(el);
    const src = $img.attr("src") ?? "";
    // Heuristics: 1×1 size, "open"/"track" in URL, or invisible styling.
    const width = ($img.attr("width") ?? "").trim();
    const height = ($img.attr("height") ?? "").trim();
    const isTinyPixel =
      (width === "1" && height === "1") ||
      /1px/i.test($img.attr("style") ?? "") ||
      TRACKING_URL_RE.test(src);
    if (isTinyPixel) {
      $img.attr("data-original-src", src);
      $img.attr("src", TRANSPARENT_PIXEL_DATA_URI);
    }
  });

  return $.html();
}
