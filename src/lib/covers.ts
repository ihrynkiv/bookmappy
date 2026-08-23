/**
 * Cover URL handling, kept out of the component so it can be tested directly
 * without breaking React fast refresh.
 */

/** Anything this small is Open Library's placeholder, not cover art. */
export const MIN_REAL_COVER_PX = 2;

/**
 * Open Library answers a missing cover with HTTP 200 and a 1x1 transparent GIF
 * unless asked for `?default=false`, which 404s instead. Libraries imported
 * before that flag was added carry unflagged URLs, so normalise them here
 * rather than migrating stored data.
 */
export function withDefaultFalse(url: string | null): string | null {
  if (!url || !url.includes("covers.openlibrary.org")) return url;
  if (/[?&]default=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}default=false`;
}

/** Stable hue per author, so an author's books share a colour on the shelf. */
export function coverHue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

export function coverInitial(title: string): string {
  const first = title.trim().replace(/^(the|a|an)\s+/i, "").charAt(0);
  return (first || "?").toUpperCase();
}
