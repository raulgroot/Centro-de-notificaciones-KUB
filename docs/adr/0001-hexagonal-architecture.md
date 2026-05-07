# ADR 0001: Arquitectura hexagonal (ports & adapters)

**Estado:** aceptada · **Fecha:** 2026-05-06

## Contexto

La plataforma se consume hoy desde un Next.js standalone, pero existe la posibilidad real de:

- Embeberla dentro de otra plataforma (Kublau, dashboard de cliente).
- Migrar de Vercel/Supabase a otro hosting.
- Cambiar la fuente de datos (Kublau podría exponer una API REST en vez de ClickHouse).
- Reemplazar el LLM (Claude → otro).

## Decisión

Adoptamos arquitectura hexagonal con tres capas explícitas:

1. **`lib/core/`** — lógica de negocio pura, sin dependencias de infraestructura.
2. **`lib/ports/`** — interfaces TypeScript que el core consume.
3. **`lib/adapters/`** — implementaciones concretas (ClickHouse, Supabase, AI SDK) que satisfacen los ports.

Las capas externas (`app/`, `components/`) consumen el core y no importan adapters directamente.

## Consecuencias

### Positivas

- Cambios de infraestructura son locales — un nuevo adapter, no una reescritura.
- Tests del core no necesitan DBs ni servicios externos (mockeamos los ports).
- Programadores nuevos pueden leer `lib/ports/` y entender el sistema en 5 minutos.

### Negativas

- Más boilerplate: cada nuevo servicio externo requiere port + adapter + cableado.
- Para cambios pequeños puede sentirse over-engineered.

### Mitigación del costo

- Solo aplicamos el patrón a servicios externos (DB, APIs externas, IA, storage). Lógica trivial puede vivir directo en `app/`.
