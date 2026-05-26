# Cómo trabajar en este repo

Guía operativa de día a día. Si vas a tocar arquitectura, lee también `docs/ARCHITECTURE.md` y los ADRs en `docs/adr/`.

---

## Setup local (primera vez)

```bash
git clone https://github.com/raulgroot/Centro-de-notificaciones-KUB.git
cd "Centro-de-notificaciones-KUB"
pnpm install
cp .env.example .env.local    # si existe; si no, pide los secrets
pnpm dev
```

Requisitos:

- **Node 20** (matchea CI y Vercel). Si tienes nvm: `nvm use 20`.
- **pnpm 10+**: `npm i -g pnpm`.
- **PostgreSQL CLI** para backups: `brew install postgresql@16`.

---

## Workflow de cambios

Trabajamos en ramas, no en `main` directo. Aunque seas un solo dev: las ramas + PRs te dan **historial limpio, posibilidad de rollback granular, y CI que valida antes de mergear**.

### Para cualquier cambio nuevo

```bash
git checkout main && git pull          # arranca de main fresco
git checkout -b feat/nombre-corto      # rama nueva con prefijo
# … código …
pnpm typecheck && pnpm lint && pnpm test    # verificación local
git add . && git commit -m "feat(area): qué cambió"
git push -u origin feat/nombre-corto
gh pr create --fill                    # o desde la UI de GitHub
```

### Convención de nombres de rama

- `feat/...` — feature nueva
- `fix/...` — bug fix
- `chore/...` — mantenimiento (deps, configs, docs)
- `refactor/...` — cambio interno sin nuevas features
- `docs/...` — solo documentación

### Convención de commits

Conventional Commits. Ejemplos del repo:

```
feat(qa): fecha global de referencia para clasificar envíos
fix(notifications): rehidratar Date desde unstable_cache
chore(deps): bump next-auth to 5.0.0-beta.31
```

### Mergeando

- Espera a que **CI pase verde** (typecheck, lint, test, build).
- Para PRs solo tuyos: **Squash and merge** desde GitHub. Mantiene `main` limpio.
- Para hotfixes urgentes que no pueden esperar CI: commitea directo a `main` con `--no-verify` y abre un PR retroactivo con el fix de raíz. **Esto debe ser excepción, no regla.**

---

## Pre-commit: qué corre automáticamente

Cada `git commit` dispara (via Husky):

1. `lint-staged` — ESLint + Prettier en archivos staged
2. `pnpm typecheck` — TypeScript en todo el proyecto
3. `pnpm test` — Vitest (57 tests, ~500ms)

Si falla cualquiera, el commit se cancela. Arregla y vuelve a commitear.

**Para saltarte el hook en una emergencia (NO recomendado):**

```bash
git commit --no-verify -m "..."
```

Y abre un issue para arreglar lo que se saltó.

---

## CI en GitHub Actions

Cada push y cada PR a `main` corre `.github/workflows/ci.yml`:

| Job      | Qué hace                                    |
| -------- | ------------------------------------------- |
| `verify` | typecheck + lint + test                     |
| `build`  | `pnpm build` (sanity-check del bundle Next) |

Ves los resultados en la pestaña **Actions** del repo o en cada PR.

---

## Tests

Vitest. Convención: `*.test.ts` junto al archivo testeado.

```bash
pnpm test           # una pasada (CI-friendly)
pnpm test:watch     # iterativo
```

**Qué se testea:**

- Funciones puras de lógica crítica (status, classification, sanitization, parsing)
- NO componentes React (por ahora — agregar `jsdom` + `@testing-library/react` si se necesita)
- NO integraciones (ClickHouse, Supabase, Postmark) — se prueban manualmente

Cuándo agregar test:

- ✅ Función pura con bordes/thresholds (fechas, lógica condicional)
- ✅ Defensa de seguridad (sanitización)
- ✅ Después de arreglar un bug — agrega un test para que no vuelva
- ❌ UI eye-candy
- ❌ Glue de adaptadores (mejor un test de integración manual)

---

## Base de datos

### Migraciones

Drizzle schema → SQL migration. Ver `drizzle/` para historia.

```bash
pnpm db:generate              # genera SQL desde lib/db/schema.ts
# revisa el SQL generado, edítalo si necesitas algo especial
pnpm tsx scripts/apply-migration.ts drizzle/00XX_nombre.sql
```

### Backups manuales

Supabase free tier tiene backups automáticos de **7 días en su lado**. Eso no basta:

- Si la cuenta se cae, adiós data
- Después de 7 días, ya fue

**Antes de cualquier migración riesgosa:**

```bash
pnpm backup:db
```

Genera `backups/backup-YYYY-MM-DD-HHMMSS.sql` (gitignored). **Súbelo a iCloud/Drive/S3** para tener respaldo off-site.

### Restaurar desde backup

```bash
psql "$DATABASE_URL" < backups/backup-XXXX.sql
```

⚠️ Esto sobreescribe la DB destino. Antes de correr en producción:

1. Crea otro proyecto Supabase de staging
2. Restaura ahí primero para validar
3. Luego procede contra prod

---

## Deploys y rollback

### Deploy normal

Push a `main` → Vercel hace deploy automático a producción.
Push a cualquier otra rama → Vercel hace **preview deploy** con URL única.

### Rollback de un deploy malo

**Opción 1 — Promover deploy anterior (más rápido):**

1. Vercel dashboard → Deployments
2. Encuentra el último deploy que sí funcionaba
3. `...` → **Promote to Production**
4. ~30 segundos y producción vuelve al estado bueno

**Opción 2 — Revert por git:**

```bash
git revert <commit-malo>
git push origin main
```

Vercel detecta el push y deploya el revert. Más lento pero deja el historial claro.

### Variables de entorno

- Locales: `.env.local` (gitignored).
- Producción: `vercel env` o el dashboard.
- Listas: `vercel env ls production`
- Cambiar: `vercel env add KEY production`

⚠️ Nunca commitees `.env.local`. Si por error lo hiciste, **rota los secrets inmediatamente**.

---

## Estructura del proyecto

```
app/              # Next.js App Router (UI + route handlers)
components/       # React components compartidos
lib/
  adapters/       # Implementaciones concretas (ClickHouse, Supabase, etc.)
  ports/          # Interfaces ("contratos") — no importan de adapters
  core/           # Lógica pura testeable
  notifications/  # Domain logic de notificaciones
docs/
  adr/            # Architecture Decision Records
  operations/     # Runbooks operativos
drizzle/          # Migrations SQL
scripts/          # Scripts CLI (backup, exports, sync)
```

**Regla dura:** `app/` y `components/` solo importan de `lib/ports/` o `lib/core/`, **nunca de `lib/adapters/`**. Esto mantiene la portabilidad (ver `docs/adr/0001-portability.md` si existe).

---

## Checklist al abrir un PR

- [ ] Ramita con nombre `feat|fix|chore|refactor|docs/...`
- [ ] Commit messages estilo Conventional Commits
- [ ] `pnpm typecheck` pasa local
- [ ] `pnpm lint` pasa local
- [ ] `pnpm test` pasa local
- [ ] Si tocaste lógica nueva crítica, agregaste tests
- [ ] Si es decisión estructural, agregaste un ADR
- [ ] CI verde en GitHub

---

## Cosas que NO hacer

Resumen de `CLAUDE.md`:

1. **Nunca escribir en ClickHouse de Kublau** (read-only).
2. **Nunca commitear `.env.local`** ni secrets.
3. **Nunca usar Edge Runtime** (incompatibilidad con drivers nativos).
4. **Nunca importar adaptadores desde `app/` o `components/`** — siempre vía ports.
5. **Nunca agregar features estructurales sin un ADR** en `docs/adr/`.
