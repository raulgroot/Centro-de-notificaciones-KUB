/**
 * Construye un prompt detallado para generadores de imagen (Midjourney,
 * DALL-E, Imagen, Sora-image, etc.) que produce hero shots en estilo HSBC.
 *
 * El prompt varía sustancialmente según el brief: producto, objetivo, tema,
 * audiencia, urgencia. La idea es que NUNCA salgan dos imágenes idénticas
 * de dos drafts distintos — cada brief inyecta sus propios "knobs" en el
 * prompt para que el modelo tenga algo concreto que retratar.
 *
 * Reglas obligatorias de marca HSBC (no negociables):
 *   1. Algo rojo visible (prenda, accesorio, objeto)
 *   2. La persona NO mira a la cámara
 *   3. Expresión auténticamente feliz
 *   4. Aspect ratio 16:9
 *   5. Sujeto en el lado derecho (right third / cuadrantes 1-2)
 *
 * Pura función, sin IO.
 */

import type { DraftBrief } from "@/lib/db/schema";
import { productDisplayName, serializeKeyInfoTags } from "./key-info";

/**
 * Género del sujeto de la imagen. Por default las piezas usaban siempre una
 * mujer; ahora alternamos hombre/mujer entre las variaciones para que la
 * campaña no sea monótona (requisito de HSBC). El texto base se escribe en
 * femenino y, si toca hombre, lo convertimos con `toMasculine`.
 */
type Gender = "woman" | "man";

/**
 * Convierte los pronombres/sustantivos femeninos del prompt a masculinos.
 * Usa límites de palabra (`\b`) para no tocar substrings dentro de otras
 * palabras (ej. "other", "where", "gather" NO se rompen). El prompt base
 * está casi siempre en posesivo ("her face", "her hands"), por eso el
 * default de "her" es "his"; el único caso objeto frecuente ("to her") se
 * maneja explícitamente antes.
 */
export function toMasculine(text: string): string {
  return text
    .replace(/\bto her\b/g, "to him")
    .replace(/\bWomen\b/g, "Men")
    .replace(/\bwomen\b/g, "men")
    .replace(/\bWoman\b/g, "Man")
    .replace(/\bwoman\b/g, "man")
    .replace(/\bShe\b/g, "He")
    .replace(/\bshe\b/g, "he")
    .replace(/\bHerself\b/g, "Himself")
    .replace(/\bherself\b/g, "himself")
    .replace(/\bHers\b/g, "His")
    .replace(/\bhers\b/g, "his")
    .replace(/\bHer\b/g, "His")
    .replace(/\bher\b/g, "his");
}

/**
 * Restricciones que aplican a TODAS las variaciones (requisito HSBC):
 *   - Sin marcas / logos / packaging reconocible en ningún lado.
 *   - El personaje NUNCA bebe ni sostiene bebidas alcohólicas.
 */
const NO_BRAND_NO_ALCOHOL =
  "MANDATORY restrictions (apply to EVERY image, no exceptions): absolutely NO brand logos, trademarks, wordmarks, or recognizable branded packaging anywhere in the frame — not on clothing, phones, laptops, cups, bags, bottles, or background signage. The subject must NEVER be drinking, holding, or positioned near any alcoholic beverage — no wine, beer, champagne, cocktails, or spirits. If a drink appears it must be clearly non-alcoholic (coffee, tea, water, juice).";

/** Fragmento que se antepone a cada lista "Avoid:" para reforzar lo anterior. */
const SHARED_AVOID =
  "visible brand logos, trademarks or branded packaging of any kind, any alcoholic beverage (wine, beer, champagne, cocktails, spirits) or the subject drinking/holding alcohol, ";

/**
 * Línea que se inyecta cerca del sujeto para fijar el género de ESTA imagen
 * y dejar claro que la campaña alterna a propósito (no siempre mujer).
 */
function genderDirective(gender: Gender): string {
  const noun = gender === "man" ? "man" : "woman";
  return `SUBJECT FOR THIS IMAGE: a Mexican ${noun}. The campaign deliberately alternates between men and women across pieces — this variation is intentional, do not default to always using the same gender.`;
}

/**
 * Mapa de objetivo → actividad concreta que la persona debe estar haciendo
 * + accesorios visuales que refuerzan ese objetivo. Cada entrada cambia
 * drásticamente la composición.
 */
const OBJECTIVE_SCENE: Record<string, { activity: string; propsAndAccents: string }> = {
  activar: {
    activity:
      "in the middle of activating something new — perhaps holding an unopened envelope, looking at her phone with anticipation, or unboxing a small package — there's a small celebration in her face",
    propsAndAccents:
      "a closed envelope, a newly-opened smartphone screen, a small unwrapped object, optionally a flower in a vase or a glass of water on the table — clean, ceremonial feel",
  },
  verificar: {
    activity:
      "concentrated on her phone screen, possibly entering a code or reviewing details — calm and focused, the moment just after she's confirmed something important",
    propsAndAccents:
      "a smartphone (held but with the screen NOT visible to the camera), a notebook with a pen nearby, a cup of coffee, soft afternoon light suggesting a quiet office",
  },
  agradecer: {
    activity:
      "enjoying a peaceful moment of gratitude — looking out a window with a soft smile, hands wrapped around a warm mug, or surrounded by something meaningful to her",
    propsAndAccents:
      "a warm mug, an open book, plants in soft focus, sunlight streaming sideways, optionally a thank-you card or handwritten note",
  },
  informar: {
    activity:
      "reading something on a laptop or tablet — leaning slightly forward, engaged but relaxed, the moment of discovering interesting news",
    propsAndAccents:
      "a modern laptop or tablet (screen NOT directly visible), a coffee cup, eyeglasses on the table, a notebook, a vase with a single red flower",
  },
  recordar: {
    activity:
      "glancing at her wristwatch, smartphone calendar, or a wall clock — a 'oh right, today is the day' moment of pleasant remembering",
    propsAndAccents:
      "a wristwatch, a wall clock or desk calendar visible in soft focus, a planner notebook open with handwritten notes, soft warm light",
  },
  bienvenida: {
    activity:
      "in a moment of welcome / new beginning — perhaps entering a beautiful space, receiving something with both hands, or pausing at a threshold",
    propsAndAccents:
      "fresh flowers (with red petals), a small wrapped gift, an open door with light, a 'welcome' atmosphere, slight confetti or natural sparkle",
  },
};

/**
 * Mapa de audiencia → cómo se ve y cómo se viste la persona.
 */
const AUDIENCE_SUBJECT: Record<string, string> = {
  todos: "a Mexican woman in her early 30s, contemporary professional appearance, modern style",
  nuevos:
    "a young Mexican woman in her mid-to-late 20s, fresh contemporary style, casual-modern wardrobe (clean blazer over a tee, or a stylish sweater), energy of someone new and curious",
  recurrentes:
    "a Mexican woman in her mid-to-late 30s, polished professional style, established and confident, knows what she's doing — sleek blazer, quality fabrics",
  vip: "an elegant Mexican woman in her early 40s, premium high-end professional style, refined understated luxury — quality cashmere or silk, classic accessories, the look of someone who values quality over flashy",
  morosos:
    "a Mexican woman in her 30s, thoughtful and composed, taking control of her situation — practical professional wardrobe in calm neutral tones with a pop of red, the energy of resolving and moving forward positively",
};

/**
 * Mapa de urgencia → atmósfera y intensidad del momento.
 */
const URGENCY_MOOD: Record<string, string> = {
  baja: "relaxed and unhurried, slow morning energy, soft natural light, calm composition",
  media:
    "engaged and attentive, midday focus, the energy of someone actively doing something meaningful",
  alta: "the satisfying moment right AFTER completing something important on time — relief and accomplishment, not stress; bright direct light, dynamic but not chaotic",
};

/**
 * Mapa de producto → tip de "lifestyle vibe" que ese producto representa.
 * No mostramos la tarjeta (sin logos), pero el ambiente la sugiere.
 */
const PRODUCT_VIBE: Record<string, string> = {
  viva: "youthful and joyful lifestyle, vibrant urban moments, weekends and small celebrations",
  vivaplus:
    "vibrant and ambitious lifestyle, slightly more upscale than Viva — better restaurants, weekend trips",
  "2now":
    "instant-gratification modern lifestyle — fast pace, contactless payments, dining out, on-the-go moments",
  advance:
    "established professional lifestyle, career building, calm confidence, no-nonsense quality",
  air: "travel lifestyle — airports, suitcases, hotels, the energy of someone who flies often and enjoys it",
  premier:
    "premium executive lifestyle, high-end restaurants, business class travel, refined details everywhere",
  clasica: "everyday family-oriented lifestyle, home, simple pleasures, dependability",
  zero: "minimalist no-fee lifestyle, smart financial choices, simplicity over flash, modern frugality",
};

export function buildImagePrompt(brief: DraftBrief, gender: Gender = "woman"): string {
  const product = productDisplayName(brief.product) || "an HSBC credit card";
  const productVibe = brief.product ? (PRODUCT_VIBE[brief.product.toLowerCase()] ?? "") : "";

  const subjectDescription = AUDIENCE_SUBJECT[brief.audience ?? "todos"] ?? AUDIENCE_SUBJECT.todos;

  const scene = brief.objective ? (OBJECTIVE_SCENE[brief.objective] ?? null) : null;
  const activity = scene?.activity ?? "in a positive everyday moment";
  const propsAndAccents = scene?.propsAndAccents ?? "natural lifestyle props that fit the moment";

  const mood = URGENCY_MOOD[brief.urgency ?? "media"] ?? URGENCY_MOOD.media;

  const topic = brief.topic?.trim();
  const keyInfo = serializeKeyInfoTags(brief.keyInfoTags);

  // El prompt es deliberadamente verboso — los modelos de generación de
  // imágenes responden mejor a descripciones detalladas (estilo, luz,
  // composición, lo que evitar) que a frases cortas.
  const lines: string[] = [
    // Style anchor
    "Editorial lifestyle photograph in the style of HSBC's premium banking brand campaigns. Cinematic but believable, never stock-photo generic.",
    "",

    // Subject — varía por audiencia + género
    genderDirective(gender),
    `Subject: ${subjectDescription}. She has a genuine warm smile that reaches her eyes, natural makeup, hair styled but not overdone.`,
    "",

    // ★ Regla obligatoria 1 — el sujeto SIEMPRE lleva una prenda roja
    "ABSOLUTELY MANDATORY brand element (RED CLOTHING) — this is the #1 requirement: the subject MUST be WEARING a clearly visible, vivid RED article of clothing as their main garment — for example a red blazer, red sweater, red blouse, red dress, red jacket, red shirt, or red cardigan. The red garment must be obvious and prominent, occupying a significant part of the frame, in vivid HSBC brand red (#DB0011 — saturated true red, NOT maroon, burgundy, pink, or orange). Do NOT rely on small accessories or background objects for the red — it must be the clothing the person is wearing. No logos on the garment.",
    "",

    // ★ Restricciones globales (sin marcas / sin alcohol)
    NO_BRAND_NO_ALCOHOL,
    "",

    // ★ Regla obligatoria 2 — no mira a la cámara
    "MANDATORY composition (NO EYE CONTACT): The subject is NEVER looking at the camera. Her gaze is directed off-frame to the LEFT (towards the empty open space), down at her hands, at a phone, or into the middle distance. Direct eye contact is FORBIDDEN — this is a candid editorial moment, not a portrait.",
    "",

    // ★ Regla obligatoria 3 — feliz auténtica
    "MANDATORY emotion (GENUINE JOY): She is authentically and visibly happy — a warm real smile that reaches her eyes, the kind you have when something good just happened. Not performative, not toothy/cheesy, not forced. Subtle radiating joy.",
    "",

    // Scene context — viene directo del brief
    "Scene context (the moment we're capturing):",
    topic ? `- Topic of the notification: ${topic}` : "",
    `- What she is doing: ${activity}`,
    `- Key props and visual accents that should appear: ${propsAndAccents}`,
    keyInfo
      ? `- Specific facts mentioned in the notification (use as inspiration, don't render text): ${keyInfo}`
      : "",
    `- Product context (do not show logos or text, only suggest the lifestyle around it): ${product}.${productVibe ? ` Vibe: ${productVibe}.` : ""}`,
    "",

    // Mood — varía por urgencia
    `Atmosphere: ${mood}.`,
    "",

    // Setting
    "Setting: Modern Mexican urban environment — a sunlit cafe in CDMX, a contemporary co-working space, an elegant home office with natural light, or a soft-lit outdoor terrace. Architecture and decor feel current but timeless, never stereotyped or touristy.",
    "",

    // Visual style
    "Visual style: Studio-quality photography with soft natural lighting, slight golden hour warmth, shallow depth of field with smooth bokeh background, premium banking aesthetic. Overall palette warm and aspirational — soft beiges, gentle whites, with the red accent (from rule 1) as the focal color pop.",
    "",

    // ★ Composition: aspect ratio + cuadrantes
    "MANDATORY composition rules:",
    "- Aspect ratio: 16:9 widescreen (horizontal).",
    "- Subject placement: The person occupies the RIGHT side of the frame, positioned between the 1st and 2nd quadrants (i.e., the right third of the image, vertically centered or slightly lower). The LEFT two-thirds is open space — soft background, environment, or props with the red brand accent. This composition is critical because the email hero will be cropped to a hexagon.",
    "- Her gaze points TOWARDS the open LEFT side of the frame (looking into the empty space, never at the camera).",
    "- Eye-level perspective. Sharp focus on her face and hands; background softly blurred (f/2.8 bokeh).",
    "",

    // Quality
    "Quality: 4K resolution, sharp focus, professional commercial photography. Camera lens equivalent to 50mm or 85mm prime, f/2.8 aperture for natural subject-background separation.",
    "",

    // Negatives
    `Avoid: ${SHARED_AVOID}Direct eye contact with camera (forbidden), generic stock photo look, exaggerated cheesy smiles, plastic skin, AI artifacts, oversaturated colors, harsh shadows, blurry details on the subject's face, low-resolution texture, subject NOT wearing a red garment (the red clothing is mandatory), maroon/burgundy/pink instead of vivid red, subject placed on the LEFT side of the frame (must be RIGHT).`,
  ];

  const text = lines.filter((l) => l !== "").join("\n");
  return gender === "man" ? toMasculine(text) : text;
}

/**
 * ─────────────────── Variación 2: Contextual / Documentary ───────────────────
 *
 * Esta variación es más LITERAL al topic del wizard. Si el topic dice "lucha
 * libre", la persona está LITERALMENTE en una lucha libre. Si el topic es
 * "viaje", está en un aeropuerto. La idea: mostrar el momento de forma
 * concreta en lugar de aspiracional/abstracto.
 *
 * MISMAS reglas inmutables que la variación 1:
 *   - Sonrisa genuina / feliz
 *   - Sin contacto visual con cámara
 *   - 16:9 widescreen
 *   - Sujeto en cuadrantes 1-2 (lado derecho)
 *   - Elemento rojo presente
 */
function buildContextualPrompt(brief: DraftBrief, gender: Gender = "woman"): string {
  const topic = brief.topic?.trim() ?? "everyday positive moment";
  const product = productDisplayName(brief.product) || "an HSBC credit card";
  const keyInfo = serializeKeyInfoTags(brief.keyInfoTags);

  const lines: string[] = [
    "Documentary-style candid photograph capturing a real moment in the life of someone enjoying the HSBC banking experience. NOT staged corporate imagery — feels like a photojournalist captured this naturally.",
    "",

    // Subject more contextual: dressed FOR the topic, not for a banking ad
    genderDirective(gender),
    "Subject: A Mexican woman in her 30s, dressed appropriately for the specific moment described in the topic below. Her clothing, posture, and surroundings ALL match the literal context of what's happening. Hair and makeup natural and situation-appropriate (not over-styled).",
    "",

    // ★ Mandatory rules — el sujeto SIEMPRE lleva una prenda roja
    "ABSOLUTELY MANDATORY brand element (RED CLOTHING) — this is the #1 requirement: the subject MUST be WEARING a clearly visible, vivid RED garment (red blazer, red sweater, red blouse, red dress, red jacket, red shirt, or red cardigan), styled appropriately for the situation in the topic. The red clothing must be obvious and prominent, in vivid HSBC brand red (#DB0011 — saturated true red, NOT maroon, burgundy, pink, or orange). The red must come from what the person is WEARING, not just background objects or props. No logos on the garment.",
    "",

    // ★ Restricciones globales (sin marcas / sin alcohol)
    NO_BRAND_NO_ALCOHOL,
    "",
    "MANDATORY composition (NO EYE CONTACT): She is NEVER looking at the camera. Captured mid-action, mid-laugh, mid-glance at something happening in the scene. Gaze can be anywhere except the lens.",
    "",
    "MANDATORY emotion (GENUINE JOY): She is authentically happy in this specific moment — the kind of unguarded smile you have when you're actually enjoying what's happening (not posing for a brand). Could be laughing, smiling softly, eyes lit up with excitement.",
    "",

    // ★ The KEY DIFFERENCE: literal scene from the wizard topic
    `LITERAL SCENE (this is the most important part of the image): The image MUST show the topic of the notification as a real moment happening. Topic: "${topic}". Render this LITERALLY — if the topic mentions a specific activity, event, location, or thing, that thing should be clearly visible and recognizable in the frame, not just suggested or hinted. The woman is participating in or observing this exact scene.`,
    "",

    keyInfo
      ? `Additional context to inspire the scene (do not render any text in the image): ${keyInfo}`
      : "",
    `Product backdrop (no visible logos): ${product}.`,
    "",

    // Setting matches topic
    "Setting: Whatever real-world location matches the literal scene above. Could be an arena, a stadium, a restaurant, a hotel lobby, a street, a market, a park, a sports venue, a concert — whatever the topic implies. Authentic Mexican context.",
    "",

    // Visual style — more documentary
    "Visual style: Documentary photojournalism aesthetic. Natural available light (no studio setup), slight grain, captured in the moment. Could be slightly imperfect framing (it's not posed). Slightly desaturated colors except for the red accent which pops.",
    "",

    // Same composition rules
    "MANDATORY composition rules (same as all HSBC heroes):",
    "- Aspect ratio: 16:9 widescreen (horizontal).",
    "- Subject placement: She occupies the RIGHT side of the frame, positioned between the 1st and 2nd quadrants (right third). The LEFT two-thirds shows the context / scene / environment.",
    "- Her attention points TOWARDS the open LEFT side (looking at the action in the scene, not at the camera).",
    "- Eye-level or slightly higher perspective. Sharp focus on her face; background can be slightly motion-blurred to suggest documentary capture.",
    "",

    "Quality: 4K resolution, professional documentary photography, 35mm or 50mm lens equivalent, natural f/2.8-f/4 aperture. Could feel like a magazine editorial or National Geographic moment.",
    "",

    `Avoid: ${SHARED_AVOID}Direct eye contact (forbidden), studio look, posed model vibes, plastic skin, generic banking stock imagery, AI artifacts, oversaturated brand colors, missing or hidden topic — the topic MUST be visually present and recognizable, subject on the LEFT side (must be RIGHT), subject NOT wearing a red garment (the red clothing is mandatory), maroon/burgundy/pink instead of vivid red.`,
  ];

  const text = lines.filter((l) => l !== "").join("\n");
  return gender === "man" ? toMasculine(text) : text;
}

/**
 * Devuelve las 2 variaciones del prompt para que el usuario tenga opciones.
 * El orden es deliberado:
 *   1. Editorial (corporate-safe) — para piezas formales
 *   2. Contextual (literal al topic) — cuando el topic es interesante visualmente
 *
 * Cada variación respeta las 5 reglas inmutables de marca HSBC pero varía
 * el estilo, mood y composición. Ambas usan SIEMPRE una mujer como sujeto
 * (requisito de HSBC para estas piezas).
 */
export interface PromptVariation {
  id: "editorial" | "contextual";
  name: string;
  description: string;
  prompt: string;
}

export function buildImagePromptVariations(brief: DraftBrief): PromptVariation[] {
  // Ambas variaciones usan una mujer como sujeto (sin alternar género).
  return [
    {
      id: "editorial",
      name: "Editorial Lifestyle",
      description: "Corporate-safe, profesional, luz suave. Ideal para piezas formales.",
      prompt: buildImagePrompt(brief, "woman"),
    },
    {
      id: "contextual",
      name: "Contextual / Real",
      description:
        "Documentary, literal al topic. La persona vive el momento real del notification.",
      prompt: buildContextualPrompt(brief, "woman"),
    },
  ];
}
