/**
 * Map a notification's `products[]` to a card-art PNG served from
 * `/public/cards/`. We have 8 official HSBC card icons (2now, advance, air,
 * clasica, premier, viva, vivaplus, zero) and the BD has ~30 distinct
 * product strings — most are direct matches, some are aliases (e.g. "world
 * elite" is the same tier as "premier"), and the long tail (oro, platinum,
 * one, easy point, etc.) doesn't have an official asset yet so we return
 * null and the card falls back to its lifecycle icon.
 *
 * The "empleados-X" variants share the same card art as their base product.
 * Pure function — no IO, no React.
 */

const CARD_ICONS: Record<string, string> = {
  // direct matches
  "2now": "/cards/2now.png",
  advance: "/cards/advance.png",
  air: "/cards/air.png",
  clasica: "/cards/clasica.png",
  premier: "/cards/premier.png",
  viva: "/cards/viva.png",
  vivaplus: "/cards/vivaplus.png",
  zero: "/cards/zero.png",

  // aliases (different label in the catalog, same physical card)
  "world elite": "/cards/premier.png",
  "hsbc viva": "/cards/viva.png",
  "hsbc viva plus": "/cards/vivaplus.png",
  basica: "/cards/clasica.png",

  // "empleados-X" share the same art as the base product
  "empleados-2now": "/cards/2now.png",
  "empleados-advance": "/cards/advance.png",
  "empleados-air": "/cards/air.png",
  "empleados-clasica": "/cards/clasica.png",
  "empleados-world elite": "/cards/premier.png",
  "empleados-zero": "/cards/zero.png",
};

/**
 * Look up a card icon for the given products. We try each product in order
 * (notifications usually carry only one), falling back to null when none of
 * them have a matching asset.
 */
export function cardIconFor(products: string[]): string | null {
  for (const raw of products) {
    if (!raw) continue;
    const key = raw.trim().toLowerCase();
    const hit = CARD_ICONS[key];
    if (hit) return hit;
  }
  return null;
}
