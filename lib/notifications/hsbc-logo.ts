/**
 * Logo de HSBC pre-encodeado como data URL.
 *
 * Antes hacíamos referencia a la URL pública del proyecto en Vercel
 * (centro-de-notificaciones-kub.vercel.app/hsbc-logo.svg), pero cuando
 * renombramos a `centro-notis` y eliminamos el viejo, esa URL dio 404 y
 * el logo dejó de aparecer.
 *
 * Solución: embebemos el SVG como data URL pre-encodeado en string
 * literal. Razones para no usar `node:fs` al cargar el módulo:
 *
 *   1. `lib/notifications/template.ts` se importa tanto desde server
 *      como desde client components (preview iframe en el editor), y
 *      `node:fs` no existe en el bundle del browser → build error.
 *   2. Pre-encodeado es más rápido (cero costo en runtime).
 *
 * Si en algún momento cambian el logo, regeneralo con:
 *
 *   node -e "const s = require('fs').readFileSync('public/hsbc-logo.svg', 'utf8'); console.log('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s).replace(/'/g, '%27').replace(/\"/g, '%22'));"
 *
 * URL-encode (no base64) porque para SVGs es ~30% más chico que base64
 * y el browser lo decodea directo.
 */

const _DATA_URL_GENERATED_FROM = "public/hsbc-logo.svg";

export const HSBC_LOGO_DATA_URL =
  "data:image/svg+xml;charset=utf-8,%3C%3Fxml%20version%3D%221.0%22%20encoding%3D%22utf-8%22%3F%3E%0D%0A%3C!--%20Generator%3A%20Adobe%20Illustrator%2019.2.0%2C%20SVG%20Export%20Plug-In%20.%20SVG%20Version%3A%206.00%20Build%200)%20%20--%3E%0D%0A%3Csvg%20version%3D%221.1%22%20id%3D%22HSBC_MASTERBRAND_LOGO_WW_RGB%22%0D%0A%09%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20xmlns%3Axlink%3D%22http%3A%2F%2Fwww.w3.org%2F1999%2Fxlink%22%20x%3D%220px%22%20y%3D%220px%22%20viewBox%3D%220%200%20315.9%2085%22%0D%0A%09%20style%3D%22enable-background%3Anew%200%200%20315.9%2085%3B%22%20xml%3Aspace%3D%22preserve%22%3E%0D%0A%3Crect%20x%3D%2242.6%22%20width%3D%2285%22%20height%3D%2285%22%20fill%3D%22%23ffffff%22%2F%3E%0D%0A%3Ctitle%3EHSBC_MASTERBRAND_LOGO_WW_RGB%3C%2Ftitle%3E%0D%0A%3Cpolygon%20points%3D%22170.1%2C42.6%20127.6%2C0%20127.6%2C85.1%22%20fill%3D%22%23db0011%22%2F%3E%0D%0A%3Cpolygon%20points%3D%2285.1%2C42.6%20127.6%2C0%2042.6%2C0%22%20fill%3D%22%23db0011%22%2F%3E%0D%0A%3Cpolygon%20points%3D%220%2C42.6%2042.6%2C85.1%2042.6%2C0%22%20fill%3D%22%23db0011%22%2F%3E%0D%0A%3Cpolygon%20points%3D%2285.1%2C42.6%2042.6%2C85.1%20127.6%2C85.1%22%20fill%3D%22%23db0011%22%2F%3E%0D%0A%3Cpath%20d%3D%22M207.4%2C45.1H192v15.2h-7.7V24.7h7.7v14.6h15.4V24.7h7.7v35.6h-7.7V45.1z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M233.7%2C61c-7.7%2C0-14-3.1-14.1-11.6h7.7c0.1%2C3.8%2C2.3%2C6.1%2C6.5%2C6.1c3.1%2C0%2C6.7-1.6%2C6.7-5.1c0-2.8-2.4-3.6-6.4-4.8l-2.6-0.7%0D%0A%09c-5.6-1.6-11.2-3.8-11.2-10.2c0-7.9%2C7.4-10.6%2C14.1-10.6c6.9%2C0%2C12.9%2C2.4%2C13%2C10.3h-7.7c-0.3-3.2-2.2-5.1-5.8-5.1%0D%0A%09c-2.9%2C0-5.7%2C1.5-5.7%2C4.7c0%2C2.6%2C2.4%2C3.4%2C7.4%2C5l3%2C0.9c6.1%2C1.9%2C10%2C4%2C10%2C10C248.5%2C57.9%2C240.7%2C61%2C233.7%2C61z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M252.9%2C24.8h12.4c2.3-0.1%2C4.7%2C0%2C7%2C0.4c4.3%2C1%2C7.6%2C3.8%2C7.6%2C8.6c0%2C4.6-2.9%2C6.9-7.1%2C8c4.8%2C0.9%2C8.4%2C3.3%2C8.4%2C8.6%0D%0A%09c0%2C8.1-8%2C9.9-14.2%2C9.9h-14L252.9%2C24.8z%20M265.3%2C39.6c3.4%2C0%2C6.9-0.7%2C6.9-4.8c0-3.7-3.2-4.7-6.4-4.7h-5.4v9.5H265.3z%20M266%2C55%0D%0A%09c3.6%2C0%2C7.1-0.8%2C7.1-5.2s-3-5.2-6.7-5.2h-6.1V55H266z%22%2F%3E%0D%0A%3Cpath%20d%3D%22M301.2%2C61c-11.5%2C0-16.6-7.3-16.6-18.2s5.7-18.8%2C17-18.8c7.1%2C0%2C14%2C3.2%2C14.2%2C11.2h-8c-0.4-3.6-2.8-5.4-6.2-5.4%0D%0A%09c-7%2C0-9.1%2C7.5-9.1%2C13.2c0%2C5.7%2C2.1%2C12.3%2C8.8%2C12.3c3.5%2C0%2C6.1-1.9%2C6.6-5.5h8C315.1%2C58%2C308.6%2C61%2C301.2%2C61z%22%2F%3E%0D%0A%3C%2Fsvg%3E%0D%0A";
