/**
 * Tests para `toMasculine` y el cableado de género en
 * `buildImagePromptVariations`.
 *
 * `toMasculine` reescribe los pronombres/sustantivos femeninos del prompt a
 * masculinos usando límites de palabra (`\b`). Lo riesgoso de esa función es
 * que un cambio de regex rompa los límites y empiece a corromper substrings
 * dentro de otras palabras ("other" → "othis", etc.), así que esos casos son
 * los que más cubrimos.
 */

import { describe, it, expect } from "vitest";
import { toMasculine, buildImagePromptVariations } from "./image-prompt";
import type { DraftBrief } from "@/lib/db/schema";

describe("toMasculine", () => {
  it("convierte el sustantivo woman → man", () => {
    expect(toMasculine("a Mexican woman in her 30s")).toBe("a Mexican man in his 30s");
  });

  it("convierte el plural women → men", () => {
    expect(toMasculine("both women smiled")).toBe("both men smiled");
  });

  it("convierte pronombres sujeto she/She → he/He", () => {
    expect(toMasculine("She is happy because she won")).toBe("He is happy because he won");
  });

  it("convierte posesivos her/Her → his/His", () => {
    expect(toMasculine("Her gaze and her hands")).toBe("His gaze and his hands");
  });

  it("convierte el caso objeto 'to her' → 'to him' (no 'to his')", () => {
    expect(toMasculine("something meaningful to her")).toBe("something meaningful to him");
  });

  it("convierte herself → himself", () => {
    expect(toMasculine("she did it herself")).toBe("he did it himself");
  });

  it("NO toca 'her' dentro de otras palabras (word boundaries)", () => {
    // other, where, there, gather, mother, rather contienen "her" como
    // substring pero NO deben cambiar.
    const input = "the other mother gathered rather there, whereas";
    expect(toMasculine(input)).toBe(input);
  });

  it("frase mixta: solo cambia las palabras correctas", () => {
    expect(toMasculine("The other woman gathered her things herself")).toBe(
      "The other man gathered his things himself",
    );
  });

  it("respeta capitalización al inicio de oración", () => {
    expect(toMasculine("Woman in red. Her coat is bold.")).toBe("Man in red. His coat is bold.");
  });

  it("texto sin términos de género pasa intacto", () => {
    const s = "A vivid red blazer, no eye contact, 16:9 widescreen.";
    expect(toMasculine(s)).toBe(s);
  });
});

describe("buildImagePromptVariations", () => {
  const brief: DraftBrief = {
    product: "2now",
    objective: "activar",
    audience: "todos",
    urgency: "media",
    topic: "Su tarjeta ya está lista para usarse en bici.",
  };

  it("devuelve exactamente 3 variaciones con los ids esperados", () => {
    const v = buildImagePromptVariations(brief);
    expect(v.map((x) => x.id)).toEqual(["editorial", "contextual", "cinematic"]);
  });

  it("alterna género: editorial=mujer, contextual=hombre, cinemática=mujer", () => {
    const [editorial, contextual, cinematic] = buildImagePromptVariations(brief);
    // editorial y cinemática conservan el texto base en femenino ("woman").
    expect(editorial!.prompt).toMatch(/Mexican woman/);
    expect(cinematic!.prompt).toMatch(/Mexican (woman|protagonist)/);
    // contextual se reescribe a masculino → no debe contener "woman".
    expect(contextual!.prompt).not.toMatch(/\bwoman\b/);
    expect(contextual!.prompt).toMatch(/\bman\b/);
  });

  it("las 3 variaciones exigen ROPA roja y prohíben marcas y alcohol", () => {
    for (const variation of buildImagePromptVariations(brief)) {
      expect(variation.prompt).toMatch(/RED CLOTHING/);
      expect(variation.prompt).toMatch(/NO brand logos/i);
      expect(variation.prompt).toMatch(/alcoholic/i);
    }
  });
});
