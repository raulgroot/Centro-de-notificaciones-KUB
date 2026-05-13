-- Update mockup_image_url for the Redirección flow steps.
-- Necessary because 0006_seed_redireccion_flow.sql used ON CONFLICT DO NOTHING,
-- so existing rows (created before we had the screen mockups) keep their old
-- values. This migration force-updates them.
--
-- Idempotent: safe to re-run; just sets the value to the canonical path.

WITH f AS (SELECT id FROM flows WHERE slug = 'redireccion')
UPDATE flow_steps SET mockup_image_url = v.url
FROM f, (VALUES
  (1,  '/flows/redireccion/01-sms-notificacion.png'),
  (2,  '/flows/redireccion/02-email-transito.png'),
  (3,  '/flows/redireccion/03-advertencia.png'),
  (4,  '/flows/redireccion/04-verificar-direccion.png'),
  (5,  '/flows/redireccion/05-verificacion-seguridad.png'),
  (6,  '/flows/redireccion/06-ingresar-codigo.png'),
  (7,  '/flows/redireccion/07-ingresar-direccion.png'),
  (8,  '/flows/redireccion/08-confirmar-direccion.png'),
  (9,  '/flows/redireccion/09-redireccion-exitosa.png'),
  (10, '/flows/redireccion/10-email-confirmacion.png')
) AS v(position, url)
WHERE flow_steps.flow_id = f.id
  AND flow_steps.position = v.position;
