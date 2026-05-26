/**
 * Tests para `escBold` del template del PDF de presentación.
 *
 * `escBold` primero escapa el HTML y DESPUÉS convierte el markdown
 * `**negritas**` en <strong>. Es lo que evita que en el PDF se vean los
 * asteriscos crudos (bug reportado) y, a la vez, lo que protege contra
 * inyección de HTML desde el copy generado por el AI.
 */

import { describe, it, expect } from "vitest";
import { escBold } from "./presentation-template";

describe("escBold", () => {
  it("convierte **texto** en <strong>texto</strong>", () => {
    expect(escBold("Activa tu **Tarjeta** hoy")).toBe("Activa tu <strong>Tarjeta</strong> hoy");
  });

  it("convierte el nombre de producto completo (caso real)", () => {
    expect(escBold("Tu **Tarjeta de Crédito HSBC 2Now** está lista")).toBe(
      "Tu <strong>Tarjeta de Crédito HSBC 2Now</strong> está lista",
    );
  });

  it("convierte múltiples negritas en la misma cadena", () => {
    expect(escBold("Monto **$5,000 M.N.** vence el **15 de junio**")).toBe(
      "Monto <strong>$5,000 M.N.</strong> vence el <strong>15 de junio</strong>",
    );
  });

  it("escapa HTML peligroso (anti-inyección)", () => {
    expect(escBold("<script>alert(1)</script>")).toBe("&lt;script&gt;alert(1)&lt;/script&gt;");
  });

  it("escapa HTML aun dentro de las negritas", () => {
    expect(escBold("**<b>x</b>**")).toBe("<strong>&lt;b&gt;x&lt;/b&gt;</strong>");
  });

  it("preserva entidades escapadas dentro del bold (ej. &)", () => {
    expect(escBold("Premier **A & B**")).toBe("Premier <strong>A &amp; B</strong>");
  });

  it("no toca asteriscos sueltos sin par", () => {
    expect(escBold("5*7=35 y *nota*")).toBe("5*7=35 y *nota*");
  });

  it("ignora ** vacíos (****) — sin contenido entre pares", () => {
    expect(escBold("Hola **** mundo")).toBe("Hola **** mundo");
  });

  it("string vacío / undefined / null devuelven vacío", () => {
    expect(escBold("")).toBe("");
    expect(escBold(undefined)).toBe("");
    expect(escBold(null)).toBe("");
  });

  it("texto plano sin asteriscos ni HTML pasa intacto", () => {
    const s = "Tu tarjeta con terminacion 3322 esta lista.";
    expect(escBold(s)).toBe(s);
  });
});
