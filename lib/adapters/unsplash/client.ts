/**
 * Thin Unsplash REST client para el wizard de creación.
 *
 * Reemplaza al adapter de Freepik que dejó de funcionar (free trial
 * agotado). Unsplash tiene un free tier MUY generoso:
 *   - Demo apps: 50 requests/hora (suficiente para uso interno)
 *   - Production apps: 5,000/hora (después de aprobación, también gratis)
 *
 * Solo necesitamos un endpoint: `/search/photos`. Docs:
 *   https://unsplash.com/documentation#search-photos
 *
 * **Licencia / atribución**: las fotos de Unsplash son de uso comercial
 * gratuito; no hace falta atribuir, pero es buena práctica linkear al
 * fotógrafo + Unsplash. Guardamos esos campos en `attribution` y los
 * podemos mostrar en el preview/editor si queremos.
 */

import { unsplashEnv } from "@/lib/env";

const UNSPLASH_API = "https://api.unsplash.com";

export interface UnsplashImage {
  id: string;
  /** URL de la imagen en resolución "regular" (~1080px) — ideal para hero. */
  url: string;
  /** URL más pequeña (~400px) para mostrar en el grid del picker. */
  thumbUrl: string;
  /** Alt text descriptivo provisto por el fotógrafo / Unsplash. */
  alt: string;
  /** Descripción más larga si existe. */
  description: string;
  /** Línea de atribución lista para mostrar (no requerido, pero good vibes). */
  attribution: string;
  /** Link al perfil del fotógrafo en Unsplash. */
  photographerUrl: string;
}

interface RawPhoto {
  id: string;
  urls?: { regular?: string; small?: string };
  alt_description?: string;
  description?: string;
  user?: { name?: string; links?: { html?: string } };
}

interface SearchResponse {
  results: RawPhoto[];
}

function authHeaders(): Record<string, string> {
  return {
    Authorization: `Client-ID ${unsplashEnv().accessKey}`,
    "Accept-Version": "v1",
  };
}

/**
 * Busca fotos en Unsplash. Defaults afinados para hero de email:
 *   - `orientation=landscape` (matchea el aspect del hexágono)
 *   - `content_filter=high` (evita contenido NSFW, sensible para HSBC)
 *   - `per_page=12` (un screen)
 */
export async function searchHeroImages(args: {
  query: string;
  limit?: number;
}): Promise<UnsplashImage[]> {
  const query = args.query.trim();
  if (!query) return [];
  const perPage = Math.min(Math.max(args.limit ?? 12, 1), 30);

  const url = new URL(`${UNSPLASH_API}/search/photos`);
  url.searchParams.set("query", query);
  url.searchParams.set("per_page", String(perPage));
  url.searchParams.set("orientation", "landscape");
  url.searchParams.set("content_filter", "high");

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Unsplash ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as SearchResponse;

  return (json.results ?? [])
    .filter((p) => p.urls?.regular)
    .map((p) => ({
      id: p.id,
      url: p.urls!.regular!,
      thumbUrl: p.urls?.small ?? p.urls!.regular!,
      alt: p.alt_description ?? "",
      description: p.description ?? "",
      attribution: p.user?.name ? `Foto por ${p.user.name} en Unsplash` : "Unsplash",
      photographerUrl: p.user?.links?.html ?? "https://unsplash.com",
    }));
}
