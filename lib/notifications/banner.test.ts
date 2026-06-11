/**
 * Tests para el render de banners (`bannerBlockHtml`) y su inserción en el
 * email (`renderEmailHtml`).
 *
 * Lo riesgoso: que un banner vacío renderee una caja fantasma, que el
 * contenido del usuario inyecte HTML sin escapar, o que el banner no
 * aparezca en el email final (ancla rota en el template).
 */

import { describe, it, expect } from "vitest";
import { bannerBlockHtml, bannerHasContent } from "./banner";
import { renderEmailHtml } from "./template";
import type { DraftBanner } from "@/lib/db/schema";

describe("bannerHasContent", () => {
  it("null/undefined no tienen contenido", () => {
    expect(bannerHasContent(null)).toBe(false);
    expect(bannerHasContent(undefined)).toBe(false);
  });

  it("promo/deadline requieren title; benefits requiere items; stat acepta stat o title", () => {
    expect(bannerHasContent({ style: "promo" })).toBe(false);
    expect(bannerHasContent({ style: "promo", title: "10,000 puntos" })).toBe(true);
    expect(bannerHasContent({ style: "deadline", eyebrow: "Hasta el" })).toBe(false);
    expect(bannerHasContent({ style: "benefits", title: "Incluye", items: ["  "] })).toBe(false);
    expect(bannerHasContent({ style: "benefits", items: ["Sin anualidad"] })).toBe(true);
    expect(bannerHasContent({ style: "stat", stat: "9.65%" })).toBe(true);
  });
});

describe("bannerBlockHtml", () => {
  it("banner sin contenido devuelve string vacío (no caja fantasma)", () => {
    expect(bannerBlockHtml({ style: "promo" })).toBe("");
    expect(bannerBlockHtml(null)).toBe("");
  });

  it("promo: banda roja con eyebrow, title y subtitle", () => {
    const html = bannerBlockHtml({
      style: "promo",
      eyebrow: "BONO DE BIENVENIDA",
      title: "10,000 puntos HSBC",
      subtitle: "Al activar tu tarjeta",
    });
    expect(html).toContain("#DB0011");
    expect(html).toContain("BONO DE BIENVENIDA");
    expect(html).toContain("10,000 puntos HSBC");
    expect(html).toContain("Al activar tu tarjeta");
  });

  it("deadline: usa 'Tienes hasta el' por default si no hay eyebrow", () => {
    const html = bannerBlockHtml({ style: "deadline", title: "31 de julio de 2026" });
    expect(html).toContain("Tienes hasta el");
    expect(html).toContain("31 de julio de 2026");
  });

  it("benefits: una palomita por item, ignora items vacíos", () => {
    const html = bannerBlockHtml({
      style: "benefits",
      title: "Tu tarjeta incluye",
      items: ["Sin anualidad", "", "  ", "2x puntos"],
    });
    const checks = html.match(/&#10003;/g) ?? [];
    expect(checks).toHaveLength(2);
    expect(html).toContain("Sin anualidad");
    expect(html).toContain("2x puntos");
  });

  it("stat: número grande + descripción", () => {
    const html = bannerBlockHtml({
      style: "stat",
      stat: "9.65%",
      title: "Tasa inicial desde",
      subtitle: "Con aforo hasta el 70%",
    });
    expect(html).toContain("9.65%");
    expect(html).toContain("Tasa inicial desde");
    expect(html).toContain("font-size:34px");
  });

  it("escapa HTML del contenido (sin inyección)", () => {
    const html = bannerBlockHtml({
      style: "promo",
      title: '<script>alert("x")</script> & "comillas"',
    });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&amp;");
  });

  it("todos los estilos usan la tipografía Univers del template", () => {
    const banners: DraftBanner[] = [
      { style: "promo", title: "x" },
      { style: "deadline", title: "x" },
      { style: "benefits", items: ["x"] },
      { style: "stat", stat: "x" },
    ];
    for (const b of banners) {
      expect(bannerBlockHtml(b)).toContain("Univers Next");
    }
  });
});

describe("renderEmailHtml con banner", () => {
  it("inserta el banner después del cuerpo", () => {
    const html = renderEmailHtml({
      copy: {
        body: "Tu tarjeta está lista.",
        banner: { style: "promo", title: "10,000 puntos HSBC" },
      },
      heroImage: null,
    });
    expect(html).toContain("10,000 puntos HSBC");
    // El banner va después del texto del cuerpo en el documento.
    expect(html.indexOf("Tu tarjeta está lista")).toBeLessThan(html.indexOf("10,000 puntos HSBC"));
  });

  it("sin banner el email no cambia (no caja vacía)", () => {
    const conNull = renderEmailHtml({ copy: { body: "Hola", banner: null }, heroImage: null });
    const sinCampo = renderEmailHtml({ copy: { body: "Hola" }, heroImage: null });
    expect(conNull).toBe(sinCampo);
  });

  it("banner sin body también se inserta (ancla al bloque original)", () => {
    const html = renderEmailHtml({
      copy: { banner: { style: "deadline", title: "31 de julio de 2026" } },
      heroImage: null,
    });
    expect(html).toContain("31 de julio de 2026");
  });
});
