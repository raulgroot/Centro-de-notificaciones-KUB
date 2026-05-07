# Guía para Claude Code

Este archivo se carga automáticamente en cada sesión de Claude Code en este repo.

## Contexto del proyecto

Centro interno de notificaciones para Kublau. Lee `README.md` para setup y `docs/ARCHITECTURE.md` para la visión técnica.

## Reglas duras

1. **No escribir nunca en ClickHouse de Kublau.** Es read-only. Ver `docs/adr/0003-clickhouse-readonly-source.md`.
2. **No saltarse los puertos.** Si vas a integrar un servicio externo nuevo, define primero la interfaz en `lib/ports/` y luego implementa en `lib/adapters/`. No importes adaptadores directamente desde `app/` o `components/`.
3. **No commitear `.env.local` ni secretos.** Si dudas, abre `.gitignore`.
4. **No usar Edge Runtime** (incompatibilidades con drivers nativos). Default es Node/Fluid Compute.
5. **No agregar features sin actualizar ADRs si la decisión es estructural.** ADRs viven en `docs/adr/`.

## Convenciones

- Server Components por defecto. `"use client"` solo cuando hace falta.
- Validación con `zod` en bordes (forms, route handlers).
- Naming: `kebab-case` archivos, `PascalCase` componentes, `camelCase` funciones/vars.
- TypeScript estricto. No `any`.

## Comandos útiles

```bash
pnpm dev               # arranca el server
pnpm typecheck         # verificación de tipos
pnpm lint              # ESLint
pnpm kublau:tables     # lista tablas de Kublau (requiere .env.local)
pnpm db:studio         # GUI de la DB propia
```

## Vercel + Next.js 16

@AGENTS.md
