# ADR 0003: Kublau ClickHouse como fuente read-only

**Estado:** aceptada · **Fecha:** 2026-05-06

## Contexto

Las ~1000 notificaciones viven en el warehouse ClickHouse de Kublau (`kublau_report`). Tenemos credenciales `CLICKHOUSE_URL`, `CLICKHOUSE_USER`, `CLICKHOUSE_PASSWORD`.

ClickHouse está optimizado para analítica (lecturas masivas), no para operaciones transaccionales. Escribir/editar notificaciones desde nuestra app rompería el contrato del warehouse y posiblemente rompería pipelines downstream que dependen de él.

## Decisión

Tratamos Kublau ClickHouse como **read-only**. Cualquier mutación (crear o editar notificaciones) debe ocurrir:

- En la propia plataforma de Kublau (la fuente original sigue siendo dueña de las mutaciones), **o**
- Vía un endpoint de Kublau si llegan a exponerlo.

Para "creación" desde nuestra app (fase 4 del plan), llamaremos a un endpoint de Kublau si existe, o publicaremos el draft en nuestra DB y lo "promoveremos" a Kublau cuando esté listo.

## Consecuencias

- Nuestra app NO inserta/actualiza/borra en ClickHouse.
- El versionado de cambios que hacemos vive en Supabase (ver ADR 0002).
- Si algún día se necesita escritura, requerirá un endpoint dedicado de Kublau y un nuevo ADR.
