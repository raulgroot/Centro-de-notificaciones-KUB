import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * Setup mínimo de Vitest. Sin DOM (las funciones que testeamos son puras).
 * Si en algún momento necesitamos testear componentes React, agregar
 * `environment: "jsdom"` y `@testing-library/react`.
 *
 * Solo corre archivos `*.test.ts` dentro de `lib/` para mantenerlo enfocado
 * en lógica pura — no tocamos `app/` ni `node_modules`.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(fileURLToPath(new URL(".", import.meta.url))),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
    environment: "node",
    globals: false,
    reporters: ["default"],
  },
});
