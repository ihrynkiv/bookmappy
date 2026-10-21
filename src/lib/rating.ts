/**
 * Goodreads rates in quarter stars since October 2026, and its export writes
 * the exact value (`3.75`, `4.0`). Ratings here are a number from 0.25 to 5 in
 * quarter steps; `null` is unrated.
 */

/** Every rating a book can hold, best first, for the rating pickers. */
export const RATING_STEPS = Array.from({ length: 20 }, (_, i) => 5 - i * 0.25);

/**
 * Read a rating cell. `0` is how Goodreads writes "unrated". Anything off the
 * quarter grid is snapped to it, so a stray `3.8` cannot produce a value the
 * pickers have no option for.
 */
export function parseRating(raw: string | undefined): number | null {
  const n = Number((raw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(5, Math.max(0.25, Math.round(n * 4) / 4));
}

/** `4` for whole stars, `4.25` / `4.5` otherwise. */
export function formatRating(rating: number): string {
  return String(rating);
}

export function isWholeStar(rating: number): boolean {
  return Number.isInteger(rating);
}
