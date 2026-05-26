/**
 * Helpers defensivos para fechas en `NotificationRecord`.
 *
 * Background:
 *   Next.js `unstable_cache` serializa el resultado a JSON al guardar.
 *   Los Date objects se convierten a ISO strings al serializar, y al
 *   recuperar del cache NO se rehidratan automáticamente — quedan como
 *   strings. Llamar `.getTime()` / `.toISOString()` sobre un string
 *   lanza `TypeError: ... is not a function` y tumba toda la página.
 *
 *   Fue exactamente la causa raíz del "This page couldn't load"
 *   intermitente en /notifications: cache miss → Dates reales → OK;
 *   cache hit (dentro de 60s TTL) → strings → crash.
 *
 *   Solución: estos helpers aceptan `Date | string | null | undefined`
 *   y normalizan al consumir. Uso preferido en lugar de llamar métodos
 *   directos sobre los campos cuando los datos puedan venir cacheados.
 */

/** Normaliza a Date o null. Acepta Date, ISO string, o null/undefined.
 *  También filtra Date con tiempo NaN (`new Date("invalid")`) para que el
 *  contrato downstream sea sólido — toEpoch/toIso asumen un Date válido. */
export function toDate(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Epoch ms (0 si null/inválido). Útil para sort comparators. */
export function toEpoch(value: Date | string | null | undefined): number {
  const d = toDate(value);
  return d ? d.getTime() : 0;
}

/** ISO string o null. Útil para atributos HTML como `title` o `datetime`. */
export function toIso(value: Date | string | null | undefined): string | null {
  const d = toDate(value);
  return d ? d.toISOString() : null;
}
