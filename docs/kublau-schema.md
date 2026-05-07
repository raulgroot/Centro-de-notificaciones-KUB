# Esquema de Kublau ClickHouse

> Snapshot del estado del warehouse al **2026-05-06**. Si algo cambia en Kublau, re-ejecuta `pnpm kublau:tables` y `pnpm exec tsx --env-file=.env.local scripts/kublau-explore.ts`.

## Database

`kublau_report` — todas las tablas son **views materializadas estilo Blazer** (`blazer_query_<num>`).

## Tabla principal: `blazer_query_401`

**767 filas.** Cada fila es una notificación (theme/trigger) de tarjetas HSBC. Esta es la fuente de la pantalla principal.

| Columna Kublau            | Tipo                   | Alias en código | Notas                                                  |
| ------------------------- | ---------------------- | --------------- | ------------------------------------------------------ |
| `id`                      | `String` (UUID)        | `id`            | Identificador único                                    |
| `NOMBRE DE THEME/TRIGGER` | `String`               | `themeName`     | Nombre interno del trigger                             |
| `ASUNTO DEL CORREO`       | `String`               | `subject`       | Subject del email                                      |
| `TEXTO DE SMS`            | `String`               | `smsText`       | Copy SMS (vacío en muchos)                             |
| `PRODUCTO`                | `String` (JSON array)  | `products`      | Ej: `["one"]`, `["air","zero"]`                        |
| `MOVIMIENTO`              | `String` (JSON array)  | `movements`     | Tipo de evento que dispara                             |
| `TIPO DE CLIENTE`         | `String` (JSON array)  | `clientTypes`   | Segmento                                               |
| `DEBITO`                  | `String` `"SI"`/`"NO"` | `isDebit`       | true si es de tarjeta de débito                        |
| `EMPLEADO`                | `String` `"SI"`/`"NO"` | `isEmployee`    | true si dirigido a empleados                           |
| `CON THEME`               | `String` `"SI"`/`"NO"` | `hasTheme`      | true si tiene plantilla en Kublau                      |
| `ULTIMA ACTUALIZACIÓN`    | `Nullable(Date)`       | `updatedAt`     | Última edición en Kublau                               |
| `LINK AL THEME O TRIGGER` | `String`               | `themeLink`     | URL al trigger en Kublau                               |
| `LINK AL THEME/TEMPLATE`  | `String`               | `templateLink`  | URL al template en Kublau                              |
| `ULTIMO MAIL DEST`        | `Nullable(String)`     | `lastMailTo`    | Destinatario del último envío (parcialmente censurado) |
| `CUERPO DEL ULTIMO MAIL`  | `Nullable(String)`     | `htmlBody`      | HTML completo del email                                |
| `FECHA DE ENVIO`          | `Nullable(String)`     | `lastSentAt`    | Timestamp del último envío                             |
| `POSTMARK_URL`            | `Nullable(String)`     | `postmarkUrl`   | URL del servicio de envío                              |

### Cómo entender una fila

Una fila de `blazer_query_401` no es un email enviado individual — es un **theme/trigger configurado**: una notificación que puede dispararse muchas veces. Los campos `ULTIMO MAIL DEST`, `CUERPO DEL ULTIMO MAIL`, `FECHA DE ENVIO`, `POSTMARK_URL` se refieren a la **última instancia** que disparó esta notificación.

## Tablas auxiliares (métricas)

| Tabla              | Filas | Contenido                                                                                                                           |
| ------------------ | ----- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `blazer_query_425` | 288   | Métricas por pieza × producto: `Enviado`, `Abierto`, `Click en algun link`, `RSR`, `Clic fuera de tiempo`. Probablemente cohorte 1. |
| `blazer_query_426` | 104   | Mismas columnas que 425 — cohorte 2 (más reciente).                                                                                 |
| `blazer_query_291` | 36    | Conteo semanal de envíos por tipo de tarjeta.                                                                                       |
| `blazer_query_294` | 36    | Conteo semanal por tipo de movimiento.                                                                                              |

Útiles para mostrar performance/analytics dentro de la vista detalle de cada notificación.

## Tablas con error de schema

`blazer_query_17`, `53`, `134`, `221`, `340`, `345`, `373` — devuelven `EMPTY_LIST_OF_COLUMNS_QUERIED` ante `SELECT * LIMIT 1`. Probablemente views obsoletas o que dependen de tablas eliminadas. Las **ignoramos**. Si algún día se necesita una de ellas, validar primero con el equipo de Kublau qué representa.

## Por qué el adaptador es read-only

ClickHouse es analítico. Las mutaciones (crear/editar notificaciones) deben hacerse en la plataforma de Kublau original. Ver `docs/adr/0003-clickhouse-readonly-source.md`.
