/**
 * Tests para `sanitizeForPreview` — la defensa que neutraliza HTML real de
 * piezas enviadas (con tracking pixels y links live) antes de mostrarlas
 * en un iframe de preview.
 *
 * Importante: estos tests no garantizan seguridad por sí solos. El iframe
 * también va sandboxed sin allow-scripts. Esto es defensa en profundidad.
 */

import { describe, it, expect } from "vitest";
import { sanitizeForPreview } from "./sanitize-preview";

describe("sanitizeForPreview", () => {
  it("retorna vacío para input vacío o whitespace", () => {
    expect(sanitizeForPreview("")).toBe("");
    expect(sanitizeForPreview("   ")).toBe("");
  });

  describe("anchor neutralization", () => {
    it("quita el href del anchor y lo guarda en data-original-href", () => {
      const out = sanitizeForPreview('<a href="https://hsbc.com/activar">Activa</a>');
      // El anchor NO debe tener atributo `href=` propio (con espacio antes
      // para distinguirlo de `data-original-href=`).
      expect(out).not.toMatch(/\shref="https:/);
      expect(out).toContain('data-original-href="https://hsbc.com/activar"');
    });

    it("agrega style con pointer-events:none para bloquear el click", () => {
      const out = sanitizeForPreview('<a href="https://x.com">link</a>');
      expect(out).toContain("pointer-events:none");
      expect(out).toContain("cursor:not-allowed");
    });

    it("preserva otros atributos del anchor", () => {
      const out = sanitizeForPreview('<a href="https://x.com" class="cta" id="btn">link</a>');
      expect(out).toContain('class="cta"');
      expect(out).toContain('id="btn"');
    });

    it("respeta estilos previos del anchor al concatenar el bloqueo", () => {
      const out = sanitizeForPreview('<a href="https://x.com" style="color:red">link</a>');
      expect(out).toContain("color:red");
      expect(out).toContain("pointer-events:none");
    });
  });

  describe("form neutralization", () => {
    it("quita action y method del form", () => {
      const out = sanitizeForPreview('<form action="/submit" method="POST"><input /></form>');
      // El form NO debe tener `action=` propio (espacio antes para distinguir
      // de `data-original-action=`) ni `method=`.
      expect(out).not.toMatch(/\saction="\/submit"/);
      expect(out).not.toMatch(/\smethod="POST"/i);
      expect(out).toContain('data-original-action="/submit"');
    });

    it("convierte botones type=submit a type=button", () => {
      const out = sanitizeForPreview('<button type="submit">Enviar</button>');
      expect(out).toContain('type="button"');
      expect(out).not.toContain('type="submit"');
    });

    it("convierte inputs type=submit a type=button", () => {
      const out = sanitizeForPreview('<input type="submit" value="OK" />');
      expect(out).toContain('type="button"');
    });
  });

  describe("tracking pixel neutralization", () => {
    const TRANSPARENT_GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP";

    it("reemplaza pixel 1×1 con un data URI transparente", () => {
      const out = sanitizeForPreview(
        '<img src="https://pm-track.com/open.gif" width="1" height="1" />',
      );
      expect(out).toContain(TRANSPARENT_GIF);
      expect(out).toContain('data-original-src="https://pm-track.com/open.gif"');
    });

    it("detecta tracking por URL aun sin dimensions", () => {
      const out = sanitizeForPreview('<img src="https://postmark.com/api/open/abc123" />');
      expect(out).toContain(TRANSPARENT_GIF);
    });

    it("detecta tracking por URL con 'pixel' en el path", () => {
      const out = sanitizeForPreview('<img src="https://x.com/pixel.gif" />');
      expect(out).toContain(TRANSPARENT_GIF);
    });

    it("NO toca imágenes legítimas del hero", () => {
      const out = sanitizeForPreview(
        '<img src="https://kublau.com/hero/viva.png" width="600" height="400" alt="Hero" />',
      );
      expect(out).toContain('src="https://kublau.com/hero/viva.png"');
      expect(out).not.toContain(TRANSPARENT_GIF);
    });

    it("detecta pixel oculto via style 1px", () => {
      const out = sanitizeForPreview(
        '<img src="https://x.com/legit.png" style="width:1px;height:1px" />',
      );
      expect(out).toContain(TRANSPARENT_GIF);
    });
  });

  it("maneja HTML complejo sin perder estructura", () => {
    const html = `
      <html>
        <body>
          <a href="https://hsbc.com">Click</a>
          <img src="https://pm-track.com/open" width="1" height="1" />
          <img src="https://kublau.com/hero.png" />
          <form action="/submit"><button type="submit">Go</button></form>
        </body>
      </html>
    `;
    const out = sanitizeForPreview(html);
    // Todas las defensas activas
    expect(out).toContain("data-original-href");
    expect(out).toContain("data-original-src");
    expect(out).toContain("data-original-action");
    expect(out).toContain('type="button"');
    // Imagen legítima intacta
    expect(out).toContain("kublau.com/hero.png");
  });
});
