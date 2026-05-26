# Changelog

Cambios significativos del proyecto. Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/).

Para historia completa, ver `git log`. Aquí solo entran cambios que afectan el comportamiento, el workflow del equipo, o la operación.

## [Unreleased]

### Added

- Pipeline CI con GitHub Actions: typecheck, lint, test y build sanity-check en cada push y PR (`.github/workflows/ci.yml`).
- Vitest + 57 tests unitarios cubriendo lógica pura crítica:
  - `lib/core/notifications/dates.ts` (15 tests)
  - `lib/core/notifications/status.ts` (8 tests)
  - `lib/notifications/postmark-link.ts` (10 tests)
  - `lib/notifications/sanitize-preview.ts` (14 tests)
  - `lib/core/qa/parse-reference-date.ts` (10 tests)
- Script `pnpm backup:db` para dump manual de Supabase a `./backups/` (gitignored).
- Dependabot semanal para deps npm y mensual para GitHub Actions (`.github/dependabot.yml`).
- PR template en `.github/pull_request_template.md`.
- `CONTRIBUTING.md` con workflow de ramas, deploys, backups y rollback.
- `.nvmrc` pinneado a Node 20 (matchea CI).
- Subida de imagen propia en el editor de notificaciones (`/creation/[id]`) como fallback cuando Freepik no está disponible. Acepta PNG/JPG/WebP hasta 3 MB, embebido como data URL.

### Changed

- Pre-commit hook ahora corre `lint-staged` + `pnpm typecheck` + `pnpm test` (antes solo lint-staged).
- `parseReferenceDate` extraído de `app/(dashboard)/qa/actions.ts` a `lib/core/qa/parse-reference-date.ts` para que sea testeable (los archivos `"use server"` no pueden exportar funciones síncronas).

### Fixed

- `toDate` en `lib/core/notifications/dates.ts` no validaba si un `Date instanceof Date` tenía tiempo NaN — un Date inválido pasaba downstream y rompía `toEpoch`/`toIso`. Ahora filtra y devuelve `null`. Bug descubierto al escribir el test correspondiente.

---

## Histórico relevante (pre-changelog)

Estos cambios viven en `git log` pero los listamos aquí para tener un panorama:

- **fix(qa-cron)** — cron de QA cambiado a diario (Vercel Hobby no permite hourly) + botón "Refrescar ahora" en `/alertas`.
- **feat(qa+inbox)** — persistir batches de QA, cron de chequeo, bell en topbar y página `/alertas`.
- **feat(qa)** — fecha global de referencia ("subí mis cambios el día X") para clasificar envíos.
- **fix(qa)** — chunking de theme names para evitar 414 Request-URI Too Large en ClickHouse.
- **fix(notifications)** — helpers `toDate/toEpoch/toIso` para rehidratar Dates desde `unstable_cache` y no crashear `/notifications`.
- **feat(notifications)** — última pieza enviada con sanitización (`sanitizeForPreview`) y UX de 3 etapas (hidden → modal → revealed).
- **feat(postmark)** — cruce del catálogo Kublau contra Postmark con badge de "Verificado / Desactualizado / Sin coincidencia".
- **feat(creation)** — wizard de creación de notificaciones con AI (Claude Sonnet 4.5) + búsqueda Freepik.
