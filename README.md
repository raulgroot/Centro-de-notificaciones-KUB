# Centro de Notificaciones · Kublau

Plataforma interna de Kublau para **consultar, revisar, presentar y crear** notificaciones.

- **Fuente:** ClickHouse de Kublau (read-only) — ~1000 notificaciones reales.
- **App:** Next.js 16 + Supabase Postgres (datos propios) + AI SDK con Vercel AI Gateway.
- **Diseño:** arquitectura hexagonal pensada para mover/embeber esto en otro lugar mañana sin reescribir el core.

> Para la visión completa, decisiones y diagramas, lee **[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)**.

---

## Setup en 5 minutos

### 1. Requisitos

- Node 20+ (recomendado 24 LTS)
- pnpm 10+
- Cuenta en [Supabase](https://supabase.com), [Vercel](https://vercel.com) y credenciales de ClickHouse de Kublau

### 2. Instalación

```bash
pnpm install
cp .env.example .env.local
# Edita .env.local con los valores reales (ver sección abajo)
```

### 3. Variables de entorno

Abre `.env.local` y rellena en este orden:

| Bloque                                                 | De dónde sacarlas                                                                            |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| `CLICKHOUSE_*`                                         | Te las pasa el programador de Kublau                                                         |
| `NEXT_PUBLIC_SUPABASE_*` y `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API                                                          |
| `DATABASE_URL`                                         | Supabase Dashboard → Settings → Database → Connection string (modo Transaction, puerto 6543) |
| `AI_GATEWAY_API_KEY`                                   | [vercel.com/.../ai/api-keys](https://vercel.com/dashboard) (opcional en MVP)                 |

Lo demás se llena cuando se construya cada feature.

### 4. Verifica conexión a Kublau

```bash
pnpm kublau:tables
```

Esto lista todas las tablas disponibles en el warehouse `kublau_report`. Si funciona, la conexión está lista.

### 5. Migraciones de DB propia (Supabase)

```bash
pnpm db:generate    # genera SQL desde lib/db/schema.ts
pnpm db:migrate     # aplica migraciones en Supabase
```

### 6. Correr en local

```bash
pnpm dev
# → http://localhost:3000
```

---

## Estructura del repo

```
.
├── app/                       # Next.js App Router
│   ├── (dashboard)/           # rutas con sidebar
│   │   ├── notifications/     # listado + detalle
│   │   ├── flows/             # vista presentación
│   │   ├── creation/          # wizard de creación
│   │   └── qa/                # checklist QA
│   └── api/                   # endpoints internos
│
├── components/
│   ├── ui/                    # primitivos (shadcn-style)
│   └── feature/               # componentes de negocio
│
├── lib/
│   ├── core/                  # lógica pura (sin dependencias de infra)
│   ├── ports/                 # interfaces (contratos)
│   ├── adapters/              # implementaciones concretas
│   │   ├── clickhouse-kublau/ # adaptador read-only de Kublau
│   │   ├── supabase/          # adaptador de DB/auth/storage
│   │   └── ai-sdk/            # adaptador de IA
│   ├── db/                    # schema y cliente Drizzle
│   ├── env.ts                 # accesores de variables de entorno
│   └── utils.ts
│
├── scripts/                   # utilidades CLI (discovery, migraciones)
├── docs/                      # documentación viva
│   ├── ARCHITECTURE.md        # diagrama de capas + decisiones
│   ├── EMBEDDING.md           # cómo embeber esto en otra plataforma
│   ├── MIGRATION.md           # cómo mover esto a otro hosting
│   └── adr/                   # Architecture Decision Records
│
├── Dockerfile
├── docker-compose.yml
├── drizzle.config.ts
├── next.config.ts
└── package.json
```

---

## Scripts

```bash
pnpm dev               # dev server
pnpm build             # producción
pnpm start             # servir build
pnpm lint              # ESLint
pnpm lint:fix          # ESLint + autofix
pnpm typecheck         # tsc sin emitir
pnpm format            # Prettier
pnpm db:generate       # genera migraciones desde el schema
pnpm db:migrate        # aplica migraciones
pnpm db:studio         # GUI de Drizzle
pnpm kublau:tables     # lista tablas en Kublau ClickHouse
pnpm kublau:describe <tabla>  # describe columnas de una tabla de Kublau
```

---

## Despliegue

- **Vercel** (default): push a `main` → deploy automático. Variables se gestionan en el dashboard.
- **Otro hosting**: ver [`docs/MIGRATION.md`](docs/MIGRATION.md). Hay `Dockerfile` listo.

---

## Para programadores nuevos

1. Lee [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — entiende las 3 capas y por qué hexagonal.
2. Hojea [`lib/ports/`](lib/ports/) — son los contratos del sistema, todo lo demás se conecta a través de ellos.
3. Para añadir una feature: empieza por extender un puerto, luego implementa en el adapter, finalmente úsalo desde `app/`.
4. Cada decisión técnica importante está documentada en [`docs/adr/`](docs/adr/).
