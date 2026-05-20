-- QA persistente + inbox de notificaciones de transición.
--
-- Modelo:
--   qa_batches        — una fila por cada Excel que el usuario guarda.
--   qa_batch_items    — los themes dentro de ese batch, con snapshot inicial
--                       (para detectar transiciones contra el estado actual).
--   qa_notifications  — eventos del inbox del usuario (un item se mandó después
--                       de la fecha de referencia → notificación de "listo").
--
-- Scope por usuario: todo se filtra por `owner_email` (la sesión NextAuth).
--
-- RLS habilitado pero sin políticas — el acceso es vía service-role en server
-- actions / rutas autenticadas, igual que el resto del schema app-owned.

CREATE TABLE IF NOT EXISTS qa_batches (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email     text          NOT NULL,
  name            text          NOT NULL DEFAULT '',
  reference_date  timestamptz   NOT NULL,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),
  archived        boolean       NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS qa_batches_owner_idx
  ON qa_batches(owner_email, archived, created_at DESC);

CREATE TABLE IF NOT EXISTS qa_batch_items (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id                 uuid          NOT NULL REFERENCES qa_batches(id) ON DELETE CASCADE,
  theme_name               text          NOT NULL,
  -- Snapshot al momento del upload (sirve como baseline para detectar cambios).
  initial_status           text          NOT NULL,
  initial_last_sent_at     timestamptz,
  -- Estado actual (lo refresca el cron).
  current_status           text          NOT NULL,
  current_last_sent_at     timestamptz,
  last_checked_at          timestamptz   NOT NULL DEFAULT now(),
  -- Marca cuando hizo transición a "ready" por primera vez después del upload.
  -- Null = aún pendiente o nunca se mandó después de la fecha.
  became_ready_at          timestamptz
);

CREATE INDEX IF NOT EXISTS qa_batch_items_batch_idx
  ON qa_batch_items(batch_id);

-- Index parcial para que el cron sólo escanee items todavía pendientes
-- (mucho más barato que escanear todo cada hora).
CREATE INDEX IF NOT EXISTS qa_batch_items_pending_idx
  ON qa_batch_items(batch_id)
  WHERE became_ready_at IS NULL;

CREATE TABLE IF NOT EXISTS qa_notifications (
  id            uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_email   text          NOT NULL,
  batch_id      uuid          REFERENCES qa_batches(id) ON DELETE CASCADE,
  item_id       uuid          REFERENCES qa_batch_items(id) ON DELETE CASCADE,
  kind          text          NOT NULL,  -- 'item_ready' | 'batch_complete'
  theme_name    text,
  payload       jsonb         NOT NULL DEFAULT '{}'::jsonb,
  read_at       timestamptz,
  created_at    timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qa_notifications_owner_unread_idx
  ON qa_notifications(owner_email, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS qa_notifications_owner_all_idx
  ON qa_notifications(owner_email, created_at DESC);

ALTER TABLE qa_batches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_batch_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE qa_notifications ENABLE ROW LEVEL SECURITY;
