/**
 * Tests del motor de pre-flight Premier (`premier-check.ts`).
 *
 * Cubren: SMS length (universal), palabras vetadas (con discriminatorias),
 * vocabulario recomendado por pilar, orden de pilares, reinterpretación del
 * concepto, frase de cierre, nombre de producto, y el gate (ok / counts).
 * También helpers `normalize` / `containsWord` y el árbol de decisión.
 */

import { describe, it, expect } from "vitest";
import {
  runPreflight,
  normalize,
  containsWord,
  SMS_MAX_LENGTH,
  type Finding,
} from "./premier-check";
import {
  decideSegmentation,
  PREMIER_CLOSERS,
  PREMIER_PRODUCT_NAME,
  PREMIER_CONCEPT,
  buildPremierPromptBlock,
  PILLARS,
} from "./premier-rules";
import type { DraftCopy } from "@/lib/db/schema";

const ruleCodes = (findings: Finding[]) => findings.map((f) => f.rule);

describe("normalize / containsWord", () => {
  it("normaliza acentos y mayúsculas", () => {
    expect(normalize("Élite")).toBe("elite");
    expect(normalize("Próspero")).toBe("prospero");
  });

  it("matchea palabra completa ignorando acentos/caso", () => {
    expect(containsWord("Eres parte de la élite financiera", "Élite")).toBe(true);
    expect(containsWord("ELITE total", "élite")).toBe(true);
  });

  it("respeta fronteras de palabra (no matchea subcadenas)", () => {
    // "raza" NO debe matchear dentro de "abrazar".
    expect(containsWord("te quiero abrazar fuerte", "raza")).toBe(false);
    expect(containsWord("cuestión de raza", "raza")).toBe(true);
  });

  it("matchea frases multi-palabra", () => {
    expect(containsWord("viaja en clase turista", "clase turista")).toBe(true);
  });
});

describe("runPreflight — reglas universales", () => {
  it("SMS dentro del límite no genera finding", () => {
    const copy: DraftCopy = { sms: "a".repeat(SMS_MAX_LENGTH) };
    const r = runPreflight({ copy, isPremier: false });
    expect(r.findings).toHaveLength(0);
    expect(r.ok).toBe(true);
  });

  it("SMS que excede 160 es bloqueante incluso si NO es Premier", () => {
    const copy: DraftCopy = { sms: "a".repeat(SMS_MAX_LENGTH + 1) };
    const r = runPreflight({ copy, isPremier: false });
    expect(ruleCodes(r.findings)).toContain("sms-length");
    expect(r.counts.blocking).toBe(1);
    expect(r.ok).toBe(false);
  });
});

describe("runPreflight — palabras vetadas (Premier)", () => {
  it("NO corre reglas Premier cuando isPremier=false", () => {
    const copy: DraftCopy = { subject: "Para la élite que lo merece" };
    const r = runPreflight({ copy, isPremier: false });
    expect(r.findings).toHaveLength(0);
  });

  it("detecta palabra vetada simple como bloqueante", () => {
    const copy: DraftCopy = { subject: "Opulencia a tu alcance" };
    const r = runPreflight({ copy, isPremier: true });
    const f = r.findings.find((x) => x.rule === "forbidden-word");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("blocking");
    expect(f?.field).toBe("subject");
  });

  it("marca términos discriminatorios como alto riesgo y los ordena primero", () => {
    const copy: DraftCopy = { body: "Servicio para gente próspera, no para sudaca alguno." };
    const r = runPreflight({ copy, isPremier: true });
    const forbidden = r.findings.filter((x) => x.rule === "forbidden-word");
    expect(forbidden.length).toBeGreaterThan(0);
    // El primero debe ser discriminatorio (alto riesgo).
    expect(forbidden[0]?.discriminatory).toBe(true);
    expect(forbidden[0]?.message).toContain("alto riesgo");
  });

  it("no marca subcadenas inocentes", () => {
    // "indio" está vetado, pero "indiosincrasia" no existe; probamos que
    // 'india' (no vetada) y palabras que contienen 'raza' no disparan.
    const copy: DraftCopy = { body: "Te vamos a abrazar con la mejor cobertura internacional." };
    const r = runPreflight({ copy, isPremier: true });
    expect(r.findings.some((f) => f.rule === "forbidden-word")).toBe(false);
  });

  it("también revisa el texto del banner (es texto de cara al cliente)", () => {
    const copy: DraftCopy = {
      subject: "Tu tarjeta está lista",
      banner: { style: "promo", eyebrow: "SOLO PARA LA ÉLITE", title: "10,000 puntos" },
    };
    const r = runPreflight({ copy, isPremier: true });
    const f = r.findings.find((x) => x.rule === "forbidden-word");
    expect(f).toBeDefined();
    expect(f?.field).toBe("banner");
    expect(f?.severity).toBe("blocking");
  });

  it("banner limpio no genera findings de vocabulario", () => {
    const copy: DraftCopy = {
      subject: "Tu tarjeta está lista",
      banner: { style: "benefits", title: "Tu tarjeta incluye", items: ["Cobertura de viaje"] },
    };
    const r = runPreflight({ copy, isPremier: true });
    expect(r.findings.some((f) => f.rule === "forbidden-word")).toBe(false);
  });
});

describe("runPreflight — vocabulario recomendado", () => {
  it("sugiere vocabulario del pilar cuando no aparece ninguno", () => {
    const copy: DraftCopy = { subject: "Información de tu cuenta" };
    const r = runPreflight({ copy, isPremier: true, pillar: "patrimonio" });
    expect(ruleCodes(r.findings)).toContain("recommended-missing");
    const f = r.findings.find((x) => x.rule === "recommended-missing");
    expect(f?.severity).toBe("suggestion");
  });

  it("no sugiere si ya usa una palabra recomendada del pilar", () => {
    const copy: DraftCopy = { subject: "Construye tu legado con nosotros" };
    const r = runPreflight({ copy, isPremier: true, pillar: "patrimonio" });
    expect(ruleCodes(r.findings)).not.toContain("recommended-missing");
  });

  it("sin pilar no genera sugerencias de vocabulario", () => {
    const copy: DraftCopy = { subject: "Información de tu cuenta" };
    const r = runPreflight({ copy, isPremier: true });
    expect(ruleCodes(r.findings)).not.toContain("recommended-missing");
  });
});

describe("runPreflight — orden de pilares", () => {
  it("acepta el orden canónico", () => {
    const copy: DraftCopy = { body: "Patrimonio, Salud, Viajes e Internacional para ti." };
    const r = runPreflight({ copy, isPremier: true });
    expect(ruleCodes(r.findings)).not.toContain("pillar-order");
  });

  it("marca orden incorrecto como bloqueante", () => {
    const copy: DraftCopy = { body: "Internacional, Salud, Patrimonio y Viajes." };
    const r = runPreflight({ copy, isPremier: true });
    const f = r.findings.find((x) => x.rule === "pillar-order");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("blocking");
  });

  it("no valida orden si no aparecen los 4 pilares", () => {
    const copy: DraftCopy = { body: "Viajes y Patrimonio para ti." };
    const r = runPreflight({ copy, isPremier: true });
    expect(ruleCodes(r.findings)).not.toContain("pillar-order");
  });
});

describe("runPreflight — concepto de cierre", () => {
  it("bloquea la reinterpretación 'Tu mundo es HSBC Premier'", () => {
    const copy: DraftCopy = { body: "Tu mundo es HSBC Premier cuando abres una cuenta nueva." };
    const r = runPreflight({ copy, isPremier: true });
    const f = r.findings.find((x) => x.rule === "concept-violation");
    expect(f).toBeDefined();
    expect(f?.severity).toBe("blocking");
  });

  it("acepta el cierre genérico aprobado (sin warning de closer)", () => {
    const copy: DraftCopy = { body: `Bienvenido. ${PREMIER_CLOSERS.generic}` };
    const r = runPreflight({ copy, isPremier: true });
    expect(ruleCodes(r.findings)).not.toContain("closer-missing");
    expect(ruleCodes(r.findings)).not.toContain("concept-violation");
  });

  it("avisa (warning) cuando falta la frase de cierre", () => {
    const copy: DraftCopy = { body: "Gracias por tu preferencia." };
    const r = runPreflight({ copy, isPremier: true });
    const f = r.findings.find((x) => x.rule === "closer-missing");
    expect(f?.severity).toBe("warning");
  });
});

describe("runPreflight — nombre de producto", () => {
  it("avisa si menciona 'World Elite' sin el nombre completo", () => {
    const copy: DraftCopy = {
      body: "Tu World Elite tiene beneficios. Tu mundo es Premier cuando tu banco lo es.",
    };
    const r = runPreflight({ copy, isPremier: true });
    expect(ruleCodes(r.findings)).toContain("product-name");
  });

  it("no avisa si usa el nombre completo exacto", () => {
    const copy: DraftCopy = {
      body: "Tu Tarjeta de Crédito HSBC Premier World Elite. Tu mundo es Premier cuando tu banco lo es.",
    };
    const r = runPreflight({ copy, isPremier: true });
    expect(ruleCodes(r.findings)).not.toContain("product-name");
  });
});

describe("runPreflight — gate (ok / counts)", () => {
  it("ok=false cuando hay bloqueantes; counts coherentes", () => {
    const copy: DraftCopy = {
      subject: "Opulencia para la élite",
      sms: "a".repeat(SMS_MAX_LENGTH + 5),
    };
    const r = runPreflight({ copy, isPremier: true, pillar: "patrimonio" });
    expect(r.ok).toBe(false);
    expect(r.counts.blocking).toBeGreaterThanOrEqual(2); // sms + al menos una vetada
    expect(r.counts.blocking + r.counts.warning + r.counts.suggestion).toBe(r.findings.length);
  });

  it("ok=true cuando solo hay avisos/sugerencias", () => {
    const copy: DraftCopy = { subject: "Información general de tu cuenta" };
    const r = runPreflight({ copy, isPremier: true, pillar: "patrimonio" });
    expect(r.ok).toBe(true);
    expect(r.counts.blocking).toBe(0);
  });
});

describe("decideSegmentation (árbol de decisión)", () => {
  it("no segmenta si no es audiencia Premier", () => {
    expect(decideSegmentation({ isPremierAudience: false }).shouldSegment).toBe(false);
  });

  it("segmenta Premier no-omitible", () => {
    expect(decideSegmentation({ isPremierAudience: true }).shouldSegment).toBe(true);
  });

  it("omite tipos informativos/regulatorios sin excepciones", () => {
    expect(
      decideSegmentation({ isPremierAudience: true, omissionType: "informativa" }).shouldSegment,
    ).toBe(false);
  });

  it("fuerza segmentar regulatoria con múltiples triggers", () => {
    const d = decideSegmentation({
      isPremierAudience: true,
      omissionType: "regulatoria",
      regulatoryHasMultipleTriggers: true,
    });
    expect(d.shouldSegment).toBe(true);
  });

  it("fuerza segmentar si incluye la oferta de valor Premier", () => {
    const d = decideSegmentation({
      isPremierAudience: true,
      omissionType: "mantenimiento",
      includesPremierValueOffer: true,
    });
    expect(d.shouldSegment).toBe(true);
  });
});

describe("buildPremierPromptBlock (prompt de la IA)", () => {
  it("incluye nombre de producto, concepto y closer genérico", () => {
    const block = buildPremierPromptBlock();
    expect(block).toContain(PREMIER_PRODUCT_NAME);
    expect(block).toContain(PREMIER_CONCEPT);
    expect(block).toContain(PREMIER_CLOSERS.generic);
  });

  it("lista los términos discriminatorios como prohibición absoluta", () => {
    const block = buildPremierPromptBlock();
    // Un término discriminatorio de Internacional debe aparecer en el prompt.
    expect(block).toContain("Sudaca");
    expect(block.toLowerCase()).toContain("alto riesgo");
  });

  it("incluye few-shot negativos del manual", () => {
    const block = buildPremierPromptBlock();
    expect(block).toContain("Tu mundo es HSBC Premier cuando abres una cuenta nueva");
  });

  it("sin pilar NO inyecta vocabulario recomendado de un pilar específico", () => {
    const block = buildPremierPromptBlock();
    expect(block).not.toContain("Vocabulario recomendado");
  });

  it("con pilar inyecta su vocabulario recomendado, vetado y closer", () => {
    const block = buildPremierPromptBlock("patrimonio");
    expect(block).toContain("Vocabulario recomendado");
    expect(block).toContain(PILLARS.patrimonio.allowed[0]!); // "Legado"
    expect(block).toContain(PREMIER_CLOSERS.byPillar.patrimonio!);
  });
});
