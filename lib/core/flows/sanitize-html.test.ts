/**
 * Tests del sanitizador de /flows. Dos cosas importan por igual: que los
 * vectores de XSS típicos no sobrevivan, y que el HTML legítimo de los
 * mockups salga idéntico (si cambia la fidelidad, el mockup miente).
 */

import { describe, it, expect } from "vitest";
import { sanitizeMockupHtml, sanitizeRuleHtml } from "./sanitize-html";

describe("sanitizeMockupHtml — ataques", () => {
  it("borra <script> con todo y contenido", () => {
    const out = sanitizeMockupHtml(`<div>hola<script>alert(1)</script></div>`);
    expect(out).toBe("<div>hola</div>");
  });

  it("borra <style>, <iframe> y <form> con contenido", () => {
    const out = sanitizeMockupHtml(
      `<div><style>body{display:none}</style><iframe src="https://x.test"></iframe><form><input></form>ok</div>`,
    );
    expect(out).toBe("<div>ok</div>");
  });

  it("quita atributos on* (onerror, onclick, onload)", () => {
    const out = sanitizeMockupHtml(
      `<img src="/a.png" onerror="alert(1)"><button onclick="x()">B</button>`,
    );
    expect(out).not.toMatch(/onerror|onclick/i);
    expect(out).toContain('src="/a.png"');
    expect(out).toContain(">B</button>");
  });

  it("quita URLs javascript:, vbscript: y data: no-imagen", () => {
    const out = sanitizeMockupHtml(
      `<a href="javascript:alert(1)">a</a><a href=" VBScript:x">b</a><img src="data:text/html,<b>x</b>">`,
    );
    expect(out).not.toMatch(/javascript:|vbscript:|data:text/i);
  });

  it("conserva data:image (mockups con imágenes embebidas)", () => {
    const out = sanitizeMockupHtml(`<img src="data:image/png;base64,AAAA" alt="x">`);
    expect(out).toContain('src="data:image/png;base64,AAAA"');
  });

  it("desenvuelve etiquetas desconocidas pero conserva su texto", () => {
    expect(sanitizeMockupHtml(`<div><marquee>texto</marquee></div>`)).toBe("<div>texto</div>");
  });
});

describe("sanitizeMockupHtml — fidelidad", () => {
  it("un mockup real (div + svg + input) sale idéntico", () => {
    const html =
      `<div class="phone"><span class="t">Código</span>` +
      `<svg viewBox="0 0 24 24" width="24"><path d="M0 0h24v24H0z"></path><circle cx="12" cy="12" r="4"></circle></svg>` +
      `<input type="text" placeholder="123456"><textarea></textarea><button class="cta">Continuar</button></div>`;
    expect(sanitizeMockupHtml(html)).toBe(html);
  });

  it("conserva style y class inline (los mockups dependen de ellos)", () => {
    const html = `<div style="color:#DB0011" class="x">a</div>`;
    expect(sanitizeMockupHtml(html)).toBe(html);
  });
});

describe("sanitizeRuleHtml", () => {
  it("deja pasar <strong> (lo único que usan las reglas hoy)", () => {
    expect(sanitizeRuleHtml("Nunca pidas el <strong>NIP</strong>")).toBe(
      "Nunca pidas el <strong>NIP</strong>",
    );
  });

  it("desenvuelve estructura (div, img…) y borra scripts", () => {
    expect(sanitizeRuleHtml(`<div>a<img src=x onerror=alert(1)></div><script>x</script>`)).toBe(
      "a",
    );
  });
});
