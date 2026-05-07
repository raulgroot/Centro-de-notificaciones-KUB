# ADR 0004: IA vía Vercel AI Gateway

**Estado:** aceptada · **Fecha:** 2026-05-06

## Contexto

Necesitamos generación y revisión de copy con un LLM. El proveedor por defecto es Anthropic (Claude). Pero queremos:

- Failover si un proveedor cae.
- Observabilidad de costos.
- Capacidad de cambiar de modelo sin redeploy.

## Decisión

Usamos **Vercel AI SDK** con **Vercel AI Gateway** y referenciamos modelos por string (`"anthropic/claude-opus-4-7"`). No usamos packages provider-específicos (`@ai-sdk/anthropic`) por defecto.

Toda la integración vive detrás de `lib/ports/ai.ts`. La implementación concreta está en `lib/adapters/ai-sdk/`.

## Consecuencias

- Cambiar de modelo = cambiar 1 string.
- Cambiar de provider = mismo cambio.
- Si Vercel AI Gateway no es suficiente más adelante, podemos crear un nuevo adapter que pegue directo al provider — los consumidores del port no cambian.
