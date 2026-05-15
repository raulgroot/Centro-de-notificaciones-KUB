/**
 * Thin Freepik REST client for the /creation wizard hero-image picker.
 *
 * Just `fetch` + the user's API key — no SDK, no extra deps. We only need
 * one endpoint right now (resources search). Docs:
 *   https://docs.freepik.com/api-reference/resources/get-all-resources
 */

import { freepikEnv } from "@/lib/env";

const FREEPIK_API = "https://api.freepik.com/v1";

export interface FreepikImage {
  id: string;
  title: string;
  /** Big preview URL (~1080px wide). Good enough for an email hero. */
  url: string;
  /** Small thumbnail for the picker grid. */
  thumbUrl: string;
  /** Link back to Freepik for attribution if needed. */
  pageUrl?: string;
}

interface RawResource {
  id: number;
  title: string;
  image?: {
    source?: { url?: string };
    thumbnail?: { url?: string };
  };
  thumbnails?: { url: string; type?: string }[];
  preview?: { url?: string };
  url?: string;
}

interface SearchResponse {
  data: RawResource[];
  meta?: { pagination?: { total?: number } };
}

function authHeaders(): Record<string, string> {
  return {
    "x-freepik-api-key": freepikEnv().apiKey,
    Accept: "application/json",
  };
}

/**
 * Best-effort image extraction: Freepik's response shape varies by content
 * type (photo / vector / icon / AI). We try a few common locations.
 */
function pickUrls(r: RawResource): { url: string; thumbUrl: string } | null {
  const url =
    r.image?.source?.url ?? r.preview?.url ?? r.thumbnails?.[0]?.url ?? r.image?.thumbnail?.url;
  const thumbUrl = r.image?.thumbnail?.url ?? r.thumbnails?.[r.thumbnails.length - 1]?.url ?? url;
  if (!url || !thumbUrl) return null;
  return { url, thumbUrl };
}

/**
 * Search the Freepik catalog. Defaults are tuned for email hero images:
 *   - `content_type=photo` (vectors look weird in emails)
 *   - `orientation=landscape` (typical hero)
 *   - `limit=12` (one screen of options)
 */
export async function searchHeroImages(args: {
  query: string;
  limit?: number;
}): Promise<FreepikImage[]> {
  const query = args.query.trim();
  if (!query) return [];
  const limit = Math.min(Math.max(args.limit ?? 12, 1), 30);

  const url = new URL(`${FREEPIK_API}/resources`);
  url.searchParams.set("term", query);
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("filters[content_type][photo]", "1");
  url.searchParams.set("filters[orientation][landscape]", "1");
  url.searchParams.set("order", "relevance");

  const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Freepik ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as SearchResponse;
  const out: FreepikImage[] = [];
  for (const r of json.data ?? []) {
    const urls = pickUrls(r);
    if (!urls) continue;
    out.push({
      id: String(r.id),
      title: r.title ?? "",
      url: urls.url,
      thumbUrl: urls.thumbUrl,
      pageUrl: r.url,
    });
  }
  return out;
}
