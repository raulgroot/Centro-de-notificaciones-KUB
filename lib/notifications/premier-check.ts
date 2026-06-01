/**
 * Motor de pre-flight check para comunicaciones HSBC Premier.
 *
 * Función pura: recibe la copy + si es Premier + el pilar elegido, devuelve
 * una lista de "findings" con severidad. NO toca DB, NO toca red. La UI lo
 * corre en vivo y la compuerta de "Enviar a revisión" lo usa para decidir si
 * deja avanzar.
 *
 * Reglas implementadas (v1):
 *   - sms-length         (universal)        bloqueante si SMS > 160
 *   - forbidden-word     (Premier)          bloqueante; subtipo discriminatory = prioridad alta
 *   - recommended-missing(Premier + pilar)  sugerencia
 *   - pillar-order       (Premier)          bloqueante si aparecen los 4 pilares fuera de orden
 *   - concept-violation  (Premier)          bloqueante (reinterpretación vetada del concepto)
 *   - closer-missing     (Premier)          aviso si no hay frase de cierre del catálogo
 *   - product-name       (Premier)          aviso si se menciona "World Elite" sin el nombre completo
 *
 * Limitaciones conocidas (v1, documentadas en docs/premier-reglas-catalogo.md):
 *   - El match de palabras es por palabra completa con normalización de
 *     acentos/mayúsculas; NO maneja flexiones (plurales/género). Es una
 *     decisión pendiente con HSBC.
 *   - El color Red 3 y el uso de logo son reglas de diseño (preview), no se
 *     validan a nivel de copy aquí.
 */

import type { DraftCopy } from "@/lib/db/schema";
import {
  PILLARS,
  PILLAR_ORDER,
  PILLAR_SEQUENCE_LABEL,
  PREMIER_CONCEPT,
  PREMIER_CONCEPT_VIOLATIONS,
  PREMIER_PRODUCT_NAME,
  allApprovedClosers,
  type PillarId,
} from "./premier-rules";

export type Severity = "blocking" | "warning" | "suggestion";

export type CopyFieldName = keyof DraftCopy;

export type RuleCode =
  | "sms-length"
  | "forbidden-word"
  | "recommended-missing"
  | "pillar-order"
  | "concept-violation"
  | "closer-missing"
  | "product-name";

export interface Finding {
  /** Id estable para keys de React y de-duplicación. */
  id: string;
  severity: Severity;
  rule: RuleCode;
  /** Campo de la copy afectado, si aplica. */
  field?: CopyFieldName;
  /** Mensaje legible para el usuario. */
  message: string;
  /** El texto exacto que disparó el finding (para resaltar). */
  match?: string;
  /** Sugerencia de corrección, si aplica. */
  suggestion?: string;
  /** Solo en forbidden-word: marca término de alto riesgo (discriminatorio). */
  discriminatory?: boolean;
}

export interface PreflightInput {
  copy: DraftCopy;
  /** ¿La pieza es Premier? Si es false solo corren reglas universales. */
  isPremier: boolean;
  /** Pilar elegido (habilita sugerencias de vocabulario recomendado). */
  pillar?: PillarId | null;
}

export interface PreflightResult {
  findings: Finding[];
  counts: { blocking: number; warning: number; suggestion: number };
  /** true si NO hay findings bloqueantes (la compuerta deja pasar). */
  ok: boolean;
}

/** Límite duro de SMS (regla universal HSBC). */
export const SMS_MAX_LENGTH = 160;

/** Campos de la copy que contienen texto de cara al cliente. */
const TEXT_FIELDS: CopyFieldName[] = [
  "subject",
  "preheader",
  "headline",
  "body",
  "cta_label",
  "sms",
];

/** Normaliza: minúsculas + sin diacríticos (para comparación robusta). */
export function normalize(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * ¿`haystack` contiene `term` como palabra completa? Compara normalizado
 * (acentos/mayúsculas) y respeta fronteras de palabra (no marca subcadenas
 * dentro de otra palabra: "raza" NO matchea dentro de "abrazar").
 */
export function containsWord(haystack: string, term: string): boolean {
  const h = normalize(haystack);
  const t = normalize(term);
  if (!t) return false;
  const re = new RegExp(`(^|[^a-z0-9])${escapeRegExp(t)}([^a-z0-9]|$)`);
  return re.test(h);
}

/** Posición (índice de la primera letra) de `term` en `haystack`, o -1. */
function indexOfWord(haystack: string, term: string): number {
  const h = normalize(haystack);
  const t = normalize(term);
  if (!t) return -1;
  const re = new RegExp(`(^|[^a-z0-9])(${escapeRegExp(t)})([^a-z0-9]|$)`);
  const m = re.exec(h);
  if (!m) return -1;
  // index del grupo 2 = inicio del match + longitud del prefijo (grupo 1).
  return m.index + m[1]!.length;
}

/** Concatena los campos de texto de cara al cliente en un solo string. */
function joinedText(copy: DraftCopy): string {
  return TEXT_FIELDS.map((f) => copy[f] ?? "")
    .filter(Boolean)
    .join("\n");
}

/* ─────────────────── Reglas individuales ─────────────────── */

function checkSmsLength(copy: DraftCopy): Finding[] {
  const sms = copy.sms ?? "";
  if (sms.length <= SMS_MAX_LENGTH) return [];
  return [
    {
      id: "sms-length",
      severity: "blocking",
      rule: "sms-length",
      field: "sms",
      message: `El SMS tiene ${sms.length} caracteres; el máximo es ${SMS_MAX_LENGTH}.`,
    },
  ];
}

/** Construye la unión de palabras vetadas: normalizado → {display, discriminatory}. */
function buildForbiddenIndex(): Map<string, { display: string; discriminatory: boolean }> {
  const forbidden = new Map<string, { display: string; discriminatory: boolean }>();
  for (const p of Object.values(PILLARS)) {
    for (const w of p.forbidden) {
      const key = normalize(w);
      const prev = forbidden.get(key);
      forbidden.set(key, {
        display: prev?.display ?? w,
        discriminatory: (prev?.discriminatory ?? false) || p.discriminatory.includes(w),
      });
    }
  }
  return forbidden;
}

function checkForbiddenWords(copy: DraftCopy): Finding[] {
  const findings: Finding[] = [];
  const forbidden = buildForbiddenIndex();

  for (const field of TEXT_FIELDS) {
    const value = copy[field];
    if (!value) continue;
    for (const [key, meta] of forbidden) {
      if (containsWord(value, meta.display)) {
        findings.push({
          id: `forbidden:${field}:${key}`,
          severity: "blocking",
          rule: "forbidden-word",
          field,
          match: meta.display,
          discriminatory: meta.discriminatory,
          message: meta.discriminatory
            ? `"${meta.display}" es un término vetado de alto riesgo (exclusión/discriminación). No debe aparecer en comunicaciones World Elite.`
            : `"${meta.display}" no se permite en comunicaciones World Elite.`,
        });
      }
    }
  }
  // Discriminatorias primero (prioridad visual).
  findings.sort((a, b) => Number(b.discriminatory ?? false) - Number(a.discriminatory ?? false));
  return findings;
}

function checkRecommended(copy: DraftCopy, pillar: PillarId): Finding[] {
  const rules = PILLARS[pillar];
  const text = joinedText(copy);
  const hasAny = rules.allowed.some((w) => containsWord(text, w));
  if (hasAny) return [];
  const examples = rules.allowed.slice(0, 3).join(", ");
  return [
    {
      id: `recommended:${pillar}`,
      severity: "suggestion",
      rule: "recommended-missing",
      message: `Considera usar vocabulario del pilar ${rules.label} (ej. ${examples}).`,
    },
  ];
}

function checkPillarOrder(copy: DraftCopy): Finding[] {
  const text = joinedText(copy);
  const positions = PILLAR_ORDER.map((id) => ({
    id,
    pos: indexOfWord(text, PILLARS[id].label),
  }));
  const present = positions.filter((p) => p.pos >= 0);
  // Solo validamos orden cuando aparecen los 4 pilares (enumeración explícita).
  if (present.length < PILLAR_ORDER.length) return [];
  const ordered = [...present].sort((a, b) => a.pos - b.pos).map((p) => p.id);
  const canonical = PILLAR_ORDER.join(",");
  if (ordered.join(",") === canonical) return [];
  return [
    {
      id: "pillar-order",
      severity: "blocking",
      rule: "pillar-order",
      message: `Los pilares deben aparecer en el orden: ${PILLAR_SEQUENCE_LABEL}.`,
    },
  ];
}

function checkConceptViolations(copy: DraftCopy): Finding[] {
  const findings: Finding[] = [];
  for (const field of TEXT_FIELDS) {
    const value = copy[field];
    if (!value) continue;
    const n = normalize(value);
    for (const bad of PREMIER_CONCEPT_VIOLATIONS) {
      if (n.includes(normalize(bad))) {
        findings.push({
          id: `concept:${field}:${normalize(bad)}`,
          severity: "blocking",
          rule: "concept-violation",
          field,
          match: bad,
          message: `Prohibido reinterpretar el concepto "${PREMIER_CONCEPT}". Encontrado: "${bad}".`,
        });
      }
    }
  }
  return findings;
}

function checkCloser(copy: DraftCopy): Finding[] {
  const text = joinedText(copy);
  const n = normalize(text);
  const hasApproved = allApprovedClosers().some((c) => n.includes(normalize(c)));
  if (hasApproved) return [];
  return [
    {
      id: "closer-missing",
      severity: "warning",
      rule: "closer-missing",
      message: `Falta una frase de cierre World Elite del catálogo (ej. "${allApprovedClosers()[0]}").`,
    },
  ];
}

function checkProductName(copy: DraftCopy): Finding[] {
  const text = joinedText(copy);
  // Si menciona "World Elite" pero NO el nombre completo exacto, avisar.
  if (!containsWord(text, "World Elite")) return [];
  if (normalize(text).includes(normalize(PREMIER_PRODUCT_NAME))) return [];
  return [
    {
      id: "product-name",
      severity: "warning",
      rule: "product-name",
      message: `Usa el nombre completo del producto: "${PREMIER_PRODUCT_NAME}".`,
    },
  ];
}

/* ─────────────────── Orquestador ─────────────────── */

/**
 * Corre el pre-flight completo. Las reglas universales siempre corren; las
 * Premier solo cuando `isPremier` es true.
 */
export function runPreflight(input: PreflightInput): PreflightResult {
  const { copy, isPremier, pillar } = input;
  const findings: Finding[] = [];

  // Universal.
  findings.push(...checkSmsLength(copy));

  if (isPremier) {
    findings.push(...checkConceptViolations(copy));
    findings.push(...checkForbiddenWords(copy));
    findings.push(...checkPillarOrder(copy));
    findings.push(...checkCloser(copy));
    findings.push(...checkProductName(copy));
    if (pillar) findings.push(...checkRecommended(copy, pillar));
  }

  const counts = {
    blocking: findings.filter((f) => f.severity === "blocking").length,
    warning: findings.filter((f) => f.severity === "warning").length,
    suggestion: findings.filter((f) => f.severity === "suggestion").length,
  };

  return { findings, counts, ok: counts.blocking === 0 };
}
