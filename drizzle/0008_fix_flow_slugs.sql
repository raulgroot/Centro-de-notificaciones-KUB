-- Backfill slugs for flows that were inserted before the slug column was
-- populated. Without these slugs the `/flows/[slug]` route 404s because
-- getFlowBySlug() returns nothing.
--
-- Idempotent: the WHERE clause filters by name and current NULL slug.

UPDATE flows SET slug = 'redireccion'
WHERE name = 'Redirección para clientes' AND slug IS NULL;

UPDATE flows SET slug = 'renovacion-tdc'
WHERE name = 'Renovación TDC HSBC' AND slug IS NULL;
