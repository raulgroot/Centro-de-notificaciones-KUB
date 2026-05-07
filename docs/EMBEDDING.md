# Embeber esta plataforma en otra

Esta app está diseñada para poder vivir como producto independiente **o** como módulo dentro de otra plataforma (por ejemplo, dentro de Kublau mismo, o un dashboard del cliente).

## Tres modos de embebido

### 1. Iframe (más simple)

Hosteas la app en un dominio (Vercel u otro) y la incrustas en otro sitio:

```html
<iframe
  src="https://centro-de-notificaciones-kub.vercel.app/notifications?embed=true"
  width="100%"
  height="800"
  frameborder="0"
></iframe>
```

**Para soportarlo:**

- Configurar `Content-Security-Policy: frame-ancestors` en `next.config.ts` para permitir el dominio host.
- Soportar `?embed=true` en el layout para ocultar la barra lateral cuando esté embebido.
- Pasar autenticación vía URL hash o `postMessage` desde el host.

### 2. Reverse-proxy (más fluido)

El host monta la app bajo un path (ej. `/admin/notificaciones/*`) usando un rewrite. Configurable en `vercel.ts`:

```ts
import { routes } from "@vercel/config/v1";

export const config = {
  basePath: "/admin/notificaciones",
  rewrites: [routes.rewrite("/admin/notificaciones/(.*)", "/$1")],
};
```

### 3. Componentes publicados (más control)

Las pantallas clave (tabla de notificaciones, vista de flujo, detalle) están construidas como componentes React aislados. Mañana podemos publicarlas como paquete npm:

```bash
@kublau/notifications-ui
  ├── NotificationsTable
  ├── NotificationDetail
  ├── FlowView
  └── QAChecklist
```

Otra app las importa y le pasa un `apiBaseUrl` que apunte a nuestras `/api/*` endpoints. La separación entre UI (`components/feature/`) y data fetching (`app/api/`) ya está pensada para esto.

## Contrato API

Todas las features se exponen vía `/api/*`. Si una plataforma externa va a consumir esto:

- **`/api/health`** — liveness check.
- **`/api/notifications`** _(futuro)_ — list/search.
- **`/api/notifications/[id]`** _(futuro)_ — detail.
- **`/api/flows`** _(futuro)_ — flow list/detail.
- **`/api/kublau/tables`** — debug/discovery.

Todas devuelven JSON. Versionado de API: si rompemos compatibilidad, agregamos `/api/v2/*`.

## Theming

La UI usa Tailwind v4 con CSS variables. Otra plataforma puede pasar tokens de color y la app se reskinea sin tocar código:

```css
:root {
  --color-primary: var(--host-primary, #000);
  --color-bg: var(--host-bg, #fff);
}
```

## Auth en modo embebido

Tres opciones, ordenadas por simplicidad:

1. **Sesión heredada del host** — el host firma un JWT y nos lo pasa por cookie/header.
2. **SSO compartido** — Supabase Auth + el provider del host (Google Workspace, etc.).
3. **Auth propia** — la app autentica al usuario directamente.

La elección final se documentará en un ADR cuando llegue el momento.
