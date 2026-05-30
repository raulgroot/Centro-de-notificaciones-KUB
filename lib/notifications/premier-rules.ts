/**
 * Catálogo de reglas de marca HSBC Premier (3.0) como DATOS.
 *
 * Transcrito del `Manual Guidelines HSBC.pdf` y documentado en
 * `docs/premier-reglas-catalogo.md`. Vive en TS por ahora; la intención a
 * futuro (ver pendientes del doc) es moverlo a una tabla editable en Supabase
 * para que marketing/HSBC lo actualice sin depender de un deploy. Mientras
 * tanto, este módulo es la ÚNICA fuente de verdad: el motor de validación
 * (`premier-check.ts`), el prompt de la IA y la UI lo consumen de aquí.
 *
 * IMPORTANTE: las listas vienen de un PDF escaneado (imagen). Antes de tratarlo
 * como verdad absoluta conviene que HSBC valide ortografía y palabras cortadas
 * (pendiente #1 del catálogo).
 */

export type PillarId = "patrimonio" | "salud" | "viajes" | "internacional";

export interface PillarRules {
  id: PillarId;
  /** Etiqueta humana, tal cual debe escribirse (con mayúscula inicial). */
  label: string;
  /** Palabras recomendadas para este pilar (✓ del manual). */
  allowed: string[];
  /** Palabras vetadas para este pilar (✗ del manual). */
  forbidden: string[];
  /**
   * Subconjunto de `forbidden` considerado de ALTO RIESGO reputacional
   * (términos discriminatorios / de exclusión). Se reportan con prioridad y
   * mensaje específico. Deben ser un subconjunto exacto de `forbidden`.
   */
  discriminatory: string[];
}

/** Orden CANÓNICO de los pilares. No se puede alterar. */
export const PILLAR_ORDER: PillarId[] = ["patrimonio", "salud", "viajes", "internacional"];

/** Cómo deben aparecer escritos, en orden. */
export const PILLAR_SEQUENCE_LABEL = "Patrimonio | Salud | Viajes | Internacional";

export const PILLARS: Record<PillarId, PillarRules> = {
  patrimonio: {
    id: "patrimonio",
    label: "Patrimonio",
    allowed: [
      "Legado",
      "Patrimonio",
      "Próspero",
      "Pleno",
      "Futuro",
      "Herencia",
      "Preservar",
      "Solidez",
      "Planificar",
      "Maximizar",
      "Construir",
      "Progresar",
      "Invertir",
      "Trabajar",
      "Crecer",
      "Fortalecer",
      "Rendimientos",
      "Establecer",
    ],
    forbidden: [
      "Élite",
      "Derroche",
      "Enriquecimiento",
      "Ostentar",
      "Presumir",
      "Discriminar",
      "Clase alta",
      "Privilegios",
      "Elitismo",
      "Opulencia",
      "Desigualdad",
      "Consumir",
      "Adinerado",
      "Despilfarro",
      "Dominación",
      "Pobreza",
      "Monopolio",
    ],
    // Nota del manual: evitar palabras que denoten exclusión / discursos de
    // odio (clasistas).
    discriminatory: ["Élite", "Elitismo", "Clase alta", "Discriminar", "Desigualdad"],
  },
  salud: {
    id: "salud",
    label: "Salud",
    allowed: [
      "Bienestar",
      "Prevención",
      "Cuidado integral",
      "Calidad de vida",
      "Equilibrio",
      "Vitalidad",
      "Salud emocional",
      "Salud mental",
      "Salud física",
      "Apoyo",
      "Plan",
      "Atención",
      "Protección",
      "Tranquilidad",
    ],
    forbidden: [
      "Muerte",
      "Remedios",
      "Curandero",
      "Capacidades diferentes",
      "Milagro",
      "Resultado inmediato",
      "Cura garantizada",
    ],
    discriminatory: [],
  },
  viajes: {
    id: "viajes",
    label: "Viajes",
    allowed: [
      "Viaje",
      "Inolvidable",
      "Sueños",
      "Experiencias",
      "Mundial",
      "Extranjero",
      "Asistencia",
      "Placentero",
      "Vacaciones",
      "Viaje familiar",
      "Tranquilidad",
      "Comodidad",
      "Soporte",
      "Protección",
      "Conexiones",
      "Sin fronteras",
    ],
    forbidden: [
      "Mochilazo",
      "Mochilero",
      "Selecto",
      "Restringido",
      "Bajo costo",
      "Improvisado",
      "Nómada",
      "Austero",
      "Clase turista",
    ],
    discriminatory: [],
  },
  internacional: {
    id: "internacional",
    label: "Internacional",
    allowed: [
      "Viaje",
      "Movilidad",
      "Apertura",
      "Diversidad",
      "Red mundial",
      "Alcance",
      "Cobertura",
      "Internacional",
      "Extranjero",
      "Glocal",
      "Locales",
      "Conexiones",
      "Sin fronteras",
    ],
    forbidden: [
      "Gentrificar",
      "País barato",
      "Moneda débil",
      "Dominio",
      "Dominar",
      "Conquistar",
      "Colonia",
      "Colonizar",
      "Imponer",
      "Gringos",
      "Supremacía",
      "Nacionalista",
      "Indio",
      "Sudaca",
      "Subdesarrollado",
      "Tercermundista",
      "Raza",
    ],
    // Nota del manual: respeto; NO caer en narrativas de exclusión.
    discriminatory: [
      "Gringos",
      "Sudaca",
      "Indio",
      "Subdesarrollado",
      "Tercermundista",
      "Raza",
      "Supremacía",
      "Nacionalista",
      "Conquistar",
      "Colonizar",
    ],
  },
};

/* ─────────────────── Marca ─────────────────── */

/** Rojo Premier (Red 3, Pantone 3523C). NO es el rojo HSBC base. */
export const PREMIER_RED = "#730014";
/** Rojo HSBC base — para comunicaciones NO Premier. */
export const HSBC_RED = "#DB0011";
/** Red 3 no debe ocupar más de este % del total visual de la pieza. */
export const PREMIER_RED_MAX_COVERAGE = 0.3;

/** Nombre EXACTO del producto tope del segmento. */
export const PREMIER_PRODUCT_NAME = "Tarjeta de Crédito HSBC Premier World Elite";

/* ─────────────────── Cierres (closers) ─────────────────── */

/**
 * El concepto base de cierre. PROHIBIDO cambiar, reestructurar o reinterpretar.
 * Se usa para detectar reinterpretaciones inválidas (ej. insertar "HSBC").
 */
export const PREMIER_CONCEPT = "Tu mundo es Premier";

/** Catálogo de frases de cierre aprobadas. */
export const PREMIER_CLOSERS = {
  generic: "Tu mundo es Premier cuando tu banco lo es.",
  byPillar: {
    patrimonio: "Tu mundo es Premier cuando cimentas su futuro.",
    viajes: "Tu mundo es Premier cuando tus viajes son de otro planeta.",
  } as Partial<Record<PillarId, string>>,
};

/** Todas las frases de cierre aprobadas, en una lista plana. */
export function allApprovedClosers(): string[] {
  return [PREMIER_CLOSERS.generic, ...Object.values(PREMIER_CLOSERS.byPillar)].filter(
    (s): s is string => Boolean(s),
  );
}

/**
 * Reinterpretaciones explícitamente vetadas del concepto (de los "Don'ts" del
 * manual). Se detectan como bloqueantes. Lista en minúsculas/normalizable.
 */
export const PREMIER_CONCEPT_VIOLATIONS = [
  "Tu mundo es HSBC Premier", // insertar "HSBC" rompe el concepto
];

/**
 * Ejemplos de copy INCORRECTO del manual (sección "Don'ts"). Se usan como
 * few-shot negativos en el prompt: el modelo debe entender QUÉ evitar, no solo
 * una regla abstracta. Vincular el concepto a productos masivos / fuera de la
 * oferta Premier, o reinterpretar "Tu mundo es Premier", está prohibido.
 */
export const PREMIER_BAD_COPY_EXAMPLES = [
  "Tu mundo es HSBC Premier cuando abres una cuenta nueva",
  "Tu mundo es Premier cuando abres una cuenta N4.",
  "Tu mundo es Premier cuando solicitas una TDC Zero.",
  "Tu mundo es Premier cuando abres una cuenta digital con límite de depósitos.",
  "Tu hipoteca FOVISSSTE es HSBC Premier porque abres la puerta a un descuento.",
];

/* ─────────────────── Prompt para la IA ─────────────────── */

/**
 * Construye el bloque de instrucciones Premier que se inyecta al system prompt
 * de generación de copy cuando la pieza es Premier. Se arma desde el catálogo
 * (única fuente de verdad) para que prompt y validación nunca se desincronicen.
 *
 * Si `pillar` viene, agrega el vocabulario recomendado y el closer de ese pilar.
 */
export function buildPremierPromptBlock(pillar?: PillarId | null): string {
  const lines: string[] = [
    "",
    "=== OVERLAY DE MARCA HSBC PREMIER (segmento World Elite) ===",
    "Esta pieza es Premier. Aplica un tono y vocabulario más estrictos:",
    "",
    "Tono Premier:",
    "- Sobrio, aspiracional, centrado en la propuesta de valor Premier.",
    "- SIN sensacionalismo, SIN urgencia artificial, SIN 'da clic aquí'.",
    "- Headlines inherentes a la propuesta, no genéricos.",
    "",
    `Producto: usa SIEMPRE el nombre exacto y completo: "${PREMIER_PRODUCT_NAME}".`,
    "",
    `Concepto de cierre: "${PREMIER_CONCEPT}". PROHIBIDO cambiarlo, reestructurarlo`,
    "o reinterpretarlo (p. ej. NO insertes 'HSBC' en medio). Cierra el mailing con",
    "una frase aprobada del catálogo, por ejemplo:",
    `  • "${PREMIER_CLOSERS.generic}"`,
  ];

  // Closer por pilar, si aplica.
  const pillarCloser = pillar ? PREMIER_CLOSERS.byPillar[pillar] : undefined;
  if (pillarCloser) lines.push(`  • "${pillarCloser}"`);

  // Pilares en orden canónico.
  lines.push(
    "",
    `Si enumeras los pilares, el ORDEN es fijo: ${PILLAR_SEQUENCE_LABEL}. No lo alteres.`,
  );

  // Vocabulario recomendado / vetado del pilar elegido (o global si no hay pilar).
  if (pillar) {
    const p = PILLARS[pillar];
    lines.push(
      "",
      `Pilar dominante: ${p.label}.`,
      `- Vocabulario recomendado (úsalo cuando encaje): ${p.allowed.join(", ")}.`,
      `- Vocabulario VETADO (NO debe aparecer): ${p.forbidden.join(", ")}.`,
    );
  }

  // Términos discriminatorios de todos los pilares: nunca, jamás.
  const discriminatory = Array.from(
    new Set(Object.values(PILLARS).flatMap((p) => p.discriminatory)),
  );
  lines.push(
    "",
    "PROHIBIDO ABSOLUTO (alto riesgo reputacional): jamás uses términos de exclusión",
    `o discriminatorios como: ${discriminatory.join(", ")}.`,
  );

  // Few-shot negativos.
  lines.push(
    "",
    "Ejemplos de copy INCORRECTO (NO los imites):",
    ...PREMIER_BAD_COPY_EXAMPLES.map((ex) => `  ✗ "${ex}"`),
    "Razón: no vincules el concepto Premier a productos masivos / fuera de la oferta",
    "Premier, ni reinterpretes 'Tu mundo es Premier'.",
    "=== FIN OVERLAY PREMIER ===",
  );

  return lines.join("\n");
}

/* ─────────────────── Árbol de decisión (segmentación) ─────────────────── */

/**
 * Tipos de comunicación que normalmente OMITEN el overlay Premier (no se
 * segmentan), según la lámina "Omisiones" del manual.
 */
export type OmissionType = "regulatoria" | "informativa" | "mantenimiento" | "contingencia";

export const OMISSION_TYPES: OmissionType[] = [
  "regulatoria",
  "informativa",
  "mantenimiento",
  "contingencia",
];

export interface SegmentationDecisionInput {
  /** ¿La pieza va dirigida al segmento Premier? */
  isPremierAudience: boolean;
  /** Tipo de comunicación, si se conoce. */
  omissionType?: OmissionType | null;
  /** Excepciones que FUERZAN segmentar aunque sea de un tipo "omitible". */
  regulatoryHasMultipleTriggers?: boolean;
  addressesSpecificBenefits?: boolean;
  includesPremierValueOffer?: boolean;
}

export interface SegmentationDecision {
  /** ¿Debe aplicarse el overlay Premier (segmentar)? */
  shouldSegment: boolean;
  /** Explicación legible de por qué. */
  reason: string;
}

/**
 * Resuelve el árbol de decisión del manual: ¿esta pieza debe segmentarse a
 * tono Premier? Sirve para AUTOSUGERIR el toggle "es Premier" en el wizard.
 */
export function decideSegmentation(input: SegmentationDecisionInput): SegmentationDecision {
  if (!input.isPremierAudience) {
    return { shouldSegment: false, reason: "La pieza no va dirigida al segmento Premier." };
  }
  const isOmissible = Boolean(input.omissionType);
  if (!isOmissible) {
    return {
      shouldSegment: true,
      reason: "Pieza Premier que no es regulatoria/informativa/mantenimiento/contingencia.",
    };
  }
  // Excepción de la excepción: aun siendo de tipo "omitible", hay casos que
  // fuerzan segmentar.
  if (input.regulatoryHasMultipleTriggers) {
    return {
      shouldSegment: true,
      reason: "Pieza regulatoria con 2 o más triggers: debe segmentarse.",
    };
  }
  if (input.addressesSpecificBenefits) {
    return { shouldSegment: true, reason: "Aborda beneficios específicos: debe segmentarse." };
  }
  if (input.includesPremierValueOffer) {
    return { shouldSegment: true, reason: "Incluye la Oferta de Valor Premier: debe segmentarse." };
  }
  return {
    shouldSegment: false,
    reason: `Tipo "${input.omissionType}": normalmente se omite el overlay Premier.`,
  };
}
