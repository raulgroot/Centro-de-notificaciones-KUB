/**
 * Tests para `withRetry`: cuántas veces intenta, cuánto espera entre
 * intentos y que el error final sea el del último intento.
 */

import { describe, it, expect, vi } from "vitest";
import { withRetry } from "./retry";

const noSleep = vi.fn(async () => {});

describe("withRetry", () => {
  it("si sale a la primera, no reintenta ni espera", async () => {
    const fn = vi.fn(async () => "ok");
    const sleep = vi.fn(async () => {});
    await expect(withRetry(fn, { delaysMs: [5000, 15000], sleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("reintenta hasta que sale y espera lo configurado entre intentos", async () => {
    let n = 0;
    const fn = vi.fn(async () => {
      if (++n < 3) throw new Error(`falla ${n}`);
      return "ok";
    });
    const sleep = vi.fn(async () => {});
    await expect(withRetry(fn, { delaysMs: [5000, 15000], sleep })).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[5000], [15000]]);
  });

  it("agotados los intentos, lanza el error del último", async () => {
    let n = 0;
    const fn = async () => {
      throw new Error(`falla ${++n}`);
    };
    await expect(withRetry(fn, { delaysMs: [1, 1], sleep: noSleep })).rejects.toThrow("falla 3");
  });

  it("avisa antes de cada reintento con el número de intento", async () => {
    const onRetry = vi.fn();
    const fn = async () => {
      throw new Error("x");
    };
    await withRetry(fn, { delaysMs: [1, 1], sleep: noSleep, onRetry }).catch(() => {});
    expect(onRetry.mock.calls.map((c) => c[1])).toEqual([2, 3]);
  });
});
