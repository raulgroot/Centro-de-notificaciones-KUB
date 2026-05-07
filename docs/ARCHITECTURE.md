# Arquitectura

> Documento vivo. Cuando cambies una decisión grande, agrega un ADR en `docs/adr/` y actualiza este archivo.

## Visión

Centralizar consulta, revisión, presentación y creación de las notificaciones de Kublau, conectando con su CRM (ClickHouse) sin depender de él para datos auxiliares (versiones, comentarios, flujos, QA).

## Las 3 capas

```
┌──────────────────────────────────────────────────────────────┐
│  Capa 3 — App (Next.js 16, App Router)                       │
│  • Pantallas: notificaciones, flujos, creación, QA           │
│  • Server Components por defecto, Client Components solo     │
│    cuando necesitan estado/eventos                           │
└──────────────────────────────────────────────────────────────┘
                              │
                              │  consume puertos (interfaces)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Capa 2 — Core + Ports (lógica de negocio)                   │
│  • lib/core/      — reglas puras, sin dependencias de infra  │
│  • lib/ports/     — contratos (NotificationSource,           │
│                     MetadataRepo, AIService, StorageService) │
└──────────────────────────────────────────────────────────────┘
                              │
                              │  satisfechos por adaptadores
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Capa 1 — Adapters (implementaciones intercambiables)        │
│  • lib/adapters/clickhouse-kublau/  ← Kublau (read-only)     │
│  • lib/adapters/supabase/           ← Postgres + Auth + Files │
│  • lib/adapters/ai-sdk/             ← Claude vía AI Gateway   │
└──────────────────────────────────────────────────────────────┘
```

## Por qué hexagonal

La regla de oro: **el core no sabe nada de la infraestructura**. Solo conoce puertos.
Resultado: si mañana cambias Supabase por DynamoDB, o ClickHouse por una API REST, escribes un nuevo adapter y el resto del código no se entera.

Concretamente:

- ¿Mover a AWS? Cambia el adapter de Supabase, conserva todo lo demás.
- ¿Embeber en otra plataforma? Las APIs en `app/api/` son tu contrato. La otra plataforma habla con esos endpoints.
- ¿Cambiar Claude por GPT? Ajusta `lib/adapters/ai-sdk/` (o crea uno nuevo) — el resto no cambia.

## Datos: dos fuentes, una verdad por dato

| Tipo de dato                               | Vive en                            | Por qué                                                              |
| ------------------------------------------ | ---------------------------------- | -------------------------------------------------------------------- |
| Notificaciones (subject, copy, html, etc.) | ClickHouse de Kublau               | Ya existen ahí. Es la fuente canónica.                               |
| Versionado de cambios que hacemos          | Supabase (`notification_versions`) | Append-only. ClickHouse no es un buen lugar para escribir historial. |
| Flujos / journeys                          | Supabase (`flows`, `flow_steps`)   | Los definimos nosotros, no son de Kublau.                            |
| Links a Asana/Gmail/Freepik                | Supabase (`integration_links`)     | Pegamos external IDs, no los datos completos.                        |
| Notas de QA                                | Supabase (`qa_notes`)              | Comentarios internos, severity, resolved.                            |
| Auth                                       | Supabase Auth                      | Sesiones del equipo Kublau.                                          |
| Archivos (HTML preview, imágenes)          | Supabase Storage                   | Se sirven via CDN.                                                   |

## Flujo de una request típica

`GET /notifications/abc123`

1. Server Component pide el detalle.
2. `lib/core/notifications/service.ts` (cuando exista) llama a `NotificationSource.getById('abc123')` → adapter de ClickHouse.
3. Mismo service llama a `MetadataRepo.listVersions('abc123')` → adapter de Supabase.
4. Combina ambos resultados en un único `NotificationDetail` → lo retorna al componente.
5. El componente renderiza HTML.

El componente no toca ClickHouse ni Supabase directamente. Esa es la regla.

## Versionado: append-only

Cada vez que alguien guarda un cambio en una notificación se inserta una nueva fila en `notification_versions` con un `snapshot` JSON. La "versión actual" es la fila con mayor `version_number` para ese `kublau_notification_id`.

Beneficios:

- **Diff** entre cualquier par de versiones.
- **Rollback** = cambiar el puntero (sin destruir nada).
- **Sin esfuerzo del usuario** — guardar es versionar.

## Convenciones

- Server Components por defecto. `"use client"` solo cuando es necesario.
- Validación con `zod` en bordes (forms, route handlers).
- ESLint + Prettier corren en pre-commit (Husky + lint-staged).
- TypeScript estricto, `noUncheckedIndexedAccess` activado — paranoia útil.
- Naming: `kebab-case` archivos, `PascalCase` componentes, `camelCase` funciones/vars.

## Lo que NO hacemos (todavía)

- No escribimos en ClickHouse de Kublau. Es read-only.
- No usamos Edge Runtime — todo corre en Node (Fluid Compute) por compatibilidad con drivers nativos.
- No agregamos features sin port. Si vas a meter un nuevo servicio externo, primero define la interfaz.
