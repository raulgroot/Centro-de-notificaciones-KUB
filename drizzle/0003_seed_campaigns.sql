-- Seed data for campaign_definitions + campaign_milestones.
-- Cadence values come from:
--   - "Información Notificaciones Bono de Bienvenida HSBC.xlsx" (col MOMENTO DE ENVÍO)
--   - "Información Triggers, Retención proactiva.xlsx" (sheet 'Tiempos' + 'Triggers VIVA')
-- Safe to re-run thanks to ON CONFLICT DO NOTHING.

-- ─── Bono de Bienvenida (90 días) ──────────────────────────────────────────
INSERT INTO campaign_definitions (id, name, accent_color, default_duration_days, sort_order)
VALUES ('bb', 'Bono de Bienvenida', '#D97706', 90, 1)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_milestones (campaign_id, position, label, description, day_offset, trigger_type, flag)
VALUES
  ('bb', 0, 'Invitación',          'Envío al cargar el archivo',                  0,  'time',  1),
  ('bb', 1, 'Confirmación registro','Disparado al registrarse el cliente',        NULL,'event', NULL),
  ('bb', 2, 'Reminder 01',         '10 días después de envío sin registro',       10, 'time',  2),
  ('bb', 3, 'Reminder 02',         '20 días después de envío sin registro',       20, 'time',  2),
  ('bb', 4, 'Reminder 03',         '30 días después de envío sin registro',       30, 'time',  2),
  ('bb', 5, 'Reminder 04',         '45 días después de envío sin registro',       45, 'time',  2),
  ('bb', 6, 'Reminder 05',         '60 días sin registro (última llamada)',       60, 'time',  2),
  ('bb', 7, 'Cierre',              '90 días sin cumplir meta',                    90, 'time',  4)
ON CONFLICT DO NOTHING;

-- ─── Retención Proactiva (40 días, cadencia base VIVA / VIVA PLUS) ────────
INSERT INTO campaign_definitions (id, name, accent_color, default_duration_days, sort_order)
VALUES ('rp', 'Retención Proactiva', '#7C3AED', 40, 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO campaign_milestones (campaign_id, position, label, description, day_offset, trigger_type, flag)
VALUES
  ('rp', 0, 'Invitación',         'Envío al cargar el archivo',                  0,  'time',   1),
  ('rp', 1, 'Registro exitoso',   'Disparado al registrarse el cliente',         NULL,'event',  NULL),
  ('rp', 2, 'Reminder 01',        '5 días desde la carga',                       5,  'time',   2),
  ('rp', 3, 'Reminder 02',        '10 días desde la carga',                      10, 'time',   2),
  ('rp', 4, 'Reminder 03',        '20 días desde la carga',                      20, 'time',   2),
  ('rp', 5, 'Reminder 04',        '40 días desde la carga (último llamado)',     40, 'time',   4),
  ('rp', 6, 'Ganador',            'Disparado cuando HSBC notifica al ganador',   NULL,'manual', NULL)
ON CONFLICT DO NOTHING;
