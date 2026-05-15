-- notification_drafts: borradores de notificaciones creados desde la
-- herramienta /creation. Apilamos todo el estado del wizard en columnas
-- jsonb para no tener que migrar el schema cada vez que agregamos un
-- campo al brief o al copy. Estable solo en lo esencial: id, timestamps,
-- status, base_template_id (la noti que usamos como esqueleto HTML).
--
-- Status:
--   draft    → en edición, no compartido
--   shared   → tiene un link público y/o se le envió a HSBC
--   archived → ya no en uso (no se borra, queda como histórico)

CREATE TABLE IF NOT EXISTS notification_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidad mínima editable por el usuario
  name text NOT NULL DEFAULT '',

  -- Plantilla HTML que clonamos como esqueleto (id de notifications_cache).
  -- NULL si arrancamos desde el HTML por defecto del producto.
  base_template_id varchar(255),

  -- El brief que el usuario llena: { product, movement, lifecycle, tone, context, audience, ... }
  brief jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Copy generado / editado: { subject, preheader, headline, body, cta_label, sms, ... }
  copy jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Imagen del hero: { url, alt, source: 'freepik' | 'upload', freepik_id?, query? }
  hero_image jsonb,

  -- HTML rendereado final (snapshot del último render exitoso). Se regenera
  -- cuando cambia copy o hero_image. Lo guardamos para que el link público
  -- sirva instantáneo sin re-renderear.
  rendered_html text,

  status varchar(16) NOT NULL DEFAULT 'draft',

  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Útil para listar drafts del más reciente al más viejo.
CREATE INDEX IF NOT EXISTS notification_drafts_updated_idx
  ON notification_drafts (updated_at DESC);

-- RLS: enable y deny-all (la app accede vía service role).
ALTER TABLE notification_drafts ENABLE ROW LEVEL SECURITY;
