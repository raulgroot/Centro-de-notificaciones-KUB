# ADR 0002: Supabase como base de datos propia

**Estado:** aceptada · **Fecha:** 2026-05-06

## Contexto

Necesitamos guardar:

- Versionado de cambios sobre las notificaciones.
- Definiciones de flujos.
- Links a sistemas externos (Asana, Gmail, Freepik).
- Notas de QA y comentarios.
- Auth del equipo Kublau.
- Archivos (HTML renderizado, assets).

Kublau (ClickHouse) es read-only desde nuestra app. Necesitamos otro almacenamiento.

## Opciones evaluadas

| Opción                              | Pros                                                         | Contras                               |
| ----------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| **Supabase**                        | DB + Auth + Storage en un solo dashboard. Postgres estándar. | Mayor lock-in si usas todas sus APIs. |
| Neon Postgres + Clerk + Vercel Blob | Mejor integración Vercel-native.                             | 3 dashboards, 3 facturas.             |
| Postgres self-hosted                | Cero lock-in.                                                | Más DevOps.                           |

## Decisión

Usamos Supabase. El motivo principal es **claridad operativa**: una sola consola, una sola factura, una sola surface area para soporte.

Mitigamos el lock-in usando Drizzle ORM (no Supabase client) para queries de DB, y manteniendo Auth/Storage detrás de ports (`lib/ports/auth.ts`, `lib/ports/storage.ts`) para que un swap futuro sea local.

## Consecuencias

- Si necesitamos salir de Supabase, migramos:
  - DB → cualquier Postgres con un `pg_dump`/`psql`.
  - Auth → nuevo adapter en `lib/adapters/<nuevo>/auth.ts`.
  - Storage → nuevo adapter (S3, Vercel Blob, etc.).
- Las features que no necesiten realtime/auth pueden saltarse Supabase y hablar a Postgres directo via Drizzle.
