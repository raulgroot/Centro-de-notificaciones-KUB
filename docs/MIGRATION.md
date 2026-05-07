# Migrar a otro hosting

Cómo mover esta app fuera de Vercel/Supabase si llega el caso. La arquitectura hexagonal hace que sea cuestión de cambiar adapters, no reescribir la lógica.

## Mover el frontend (Next.js)

Soporta cualquier host de Node.js: AWS (App Runner / ECS / Lambda), GCP Cloud Run, Render, Fly.io, Railway, Docker propio.

### Vía Docker (recomendado)

```bash
docker build -t centro-notis .
docker run -p 3000:3000 --env-file .env.production centro-notis
```

Sube la imagen a tu registry (ECR, GCR, Docker Hub) y despliégala donde quieras.

### Cosas a verificar al migrar

- `next.config.ts` `output: "standalone"` (lo dejamos listo).
- Variables de entorno cargadas (no hay valores hardcodeados, todo viene de `process.env`).
- Si el host no soporta Image Optimization, deshabilitarla (`images: { unoptimized: true }`).

## Mover la base de datos

`lib/db/` usa Drizzle sobre Postgres estándar. Funciona en cualquier Postgres (RDS, Cloud SQL, Neon, Postgres self-hosted).

```bash
# 1. dump del Supabase actual
pg_dump $DATABASE_URL > backup.sql

# 2. crea el nuevo Postgres en el destino

# 3. restaura
psql $NEW_DATABASE_URL < backup.sql

# 4. actualiza DATABASE_URL en el nuevo entorno
```

Si abandonas Supabase Auth y Storage también, escribe nuevos adapters en `lib/adapters/<nuevo>/` para reemplazar `lib/adapters/supabase/`. Los puertos en `lib/ports/` no cambian.

## Mover la fuente Kublau

Si Kublau cambia de ClickHouse a otra cosa (BigQuery, REST API, etc.):

1. Crea `lib/adapters/<nueva-fuente>/notification-source.ts` que implemente `NotificationSource`.
2. Cambia el import en `lib/core/notifications/service.ts` (o donde se inyecte).
3. Borra `lib/adapters/clickhouse-kublau/` cuando estés seguro.

Cero cambios en `app/`, `lib/core/`, ni `lib/ports/`.

## Cambiar el LLM

Por defecto usamos Vercel AI Gateway con strings tipo `anthropic/claude-opus-4-7`. Para cambiar de proveedor, edita `lib/adapters/ai-sdk/` y cambia el modelo. La interfaz `AIService` no cambia.

Si abandonas AI Gateway, instala el provider package directo (`@ai-sdk/anthropic`, `@ai-sdk/openai`) y úsalo en el adapter.
