/**
 * Reintenta una operación async con esperas crecientes entre intentos.
 *
 * Para las lecturas contra ClickHouse de Kublau desde los crons: si la
 * primera lectura cae en su ventana de refresco o choca con otra query, un
 * segundo intento unos segundos después suele pasar. `delaysMs[i]` es la
 * espera antes del intento i+2; el número de intentos es delaysMs.length + 1.
 *
 * `sleep` es inyectable para que los tests no esperen de verdad.
 */

export interface RetryOptions {
  /** Esperas entre intentos, en ms. [5000, 15000] = 3 intentos. */
  delaysMs: number[];
  /** Se llama antes de cada reintento (para loguear). */
  onRetry?: (error: unknown, nextAttempt: number) => void;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let attempt = 0; attempt <= opts.delaysMs.length; attempt++) {
    if (attempt > 0) {
      opts.onRetry?.(lastError, attempt + 1);
      await sleep(opts.delaysMs[attempt - 1]!);
    }
    try {
      return await fn();
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError;
}
