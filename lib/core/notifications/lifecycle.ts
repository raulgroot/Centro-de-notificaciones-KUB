/**
 * Lifecycle stage extraction from a notification's `theme_name`.
 *
 * HSBC encodes the card-journey stage as a keyword inside the theme name
 * (e.g. "viva emitted titular alta nueva", "one delivered titular …",
 * "01 reminder advance bono de bienvenida"). Stages are not a structured
 * column, so we sniff the keyword. Pure function — no IO.
 *
 * Empirical keyword counts as of the May 2026 catalog:
 *   89 problem · 147 delivered/entregada · 82 transit · 45 emitted
 *   18 reminder/recordatorio · 10 activacion
 */

export type LifecycleStage =
  | "emitted"
  | "transit"
  | "delivered"
  | "problem"
  | "activation"
  | "reminder";

// Order matters: more specific patterns first. "problem" wins over "delivered"
// in case both appear (e.g., "delivered with problem"), and "activacion" beats
// "transit" so a key like "activacion en transito" classifies as activation.
const RULES: Array<{ stage: LifecycleStage; patterns: string[] }> = [
  { stage: "problem", patterns: ["problem"] },
  { stage: "activation", patterns: ["activacion", "activación", "activated"] },
  { stage: "reminder", patterns: ["recordatorio", "reminder"] },
  { stage: "delivered", patterns: ["delivered", "entregada", "entregado"] },
  { stage: "transit", patterns: ["transit", "tránsito", "transito"] },
  { stage: "emitted", patterns: ["emitted", "emitida", "emision", "emisión"] },
];

export function extractLifecycleStage(themeName: string | null | undefined): LifecycleStage | null {
  if (!themeName) return null;
  const t = themeName.toLowerCase();
  for (const rule of RULES) {
    if (rule.patterns.some((p) => t.includes(p))) return rule.stage;
  }
  return null;
}

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  emitted: "Emitida",
  transit: "En tránsito",
  delivered: "Entregada",
  problem: "Problema",
  activation: "Activación",
  reminder: "Recordatorio",
};

/** Visual tokens for each stage. Mirrors the patterns used elsewhere in the
 * app so the badge feels native (sky/violet/emerald/rose/purple/amber). */
export const STAGE_STYLES: Record<
  LifecycleStage,
  { bg: string; text: string; border: string; dot: string }
> = {
  emitted: {
    bg: "bg-sky-50",
    text: "text-sky-700",
    border: "border-sky-200",
    dot: "bg-sky-500",
  },
  transit: {
    bg: "bg-violet-50",
    text: "text-violet-700",
    border: "border-violet-200",
    dot: "bg-violet-500",
  },
  delivered: {
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-200",
    dot: "bg-emerald-500",
  },
  problem: {
    bg: "bg-rose-50",
    text: "text-rose-700",
    border: "border-rose-200",
    dot: "bg-rose-500",
  },
  activation: {
    bg: "bg-purple-50",
    text: "text-purple-700",
    border: "border-purple-200",
    dot: "bg-purple-500",
  },
  reminder: {
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-200",
    dot: "bg-amber-500",
  },
};

/** Ordered list for filter dropdowns. */
export const ALL_STAGES: LifecycleStage[] = [
  "emitted",
  "transit",
  "delivered",
  "activation",
  "problem",
  "reminder",
];
