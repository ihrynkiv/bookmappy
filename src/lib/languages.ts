import type { Book } from "./types";

/**
 * ISO 639-1 codes offered in the language picker. Names come from the
 * browser's own `Intl.DisplayNames`, so they need no hand-kept table; the
 * fallback covers the odd engine that lacks it.
 */
const CODES = [
  "af", "am", "ar", "az", "be", "bg", "bn", "bs", "ca", "cs", "cy", "da", "de",
  "el", "en", "eo", "es", "et", "eu", "fa", "fi", "fr", "ga", "gl", "gu", "he",
  "hi", "hr", "hu", "hy", "id", "is", "it", "ja", "ka", "kk", "km", "ko", "ky",
  "la", "lb", "lt", "lv", "mk", "ml", "mn", "mr", "ms", "mt", "my", "ne", "nl",
  "no", "pa", "pl", "pt", "ro", "ru", "sk", "sl", "sq", "sr", "sv", "sw", "ta",
  "te", "tg", "th", "tk", "tl", "tr", "uk", "ur", "uz", "vi", "yi", "zh",
];

let display: Intl.DisplayNames | null = null;
try {
  display = new Intl.DisplayNames(["en"], { type: "language" });
} catch {
  display = null;
}

export function languageName(code: string): string {
  try {
    return display?.of(code) ?? code;
  } catch {
    return code;
  }
}

/** Every pickable language, alphabetically by English name. */
export const ALL_LANGUAGES = CODES
  .map((code) => ({ code, name: languageName(code) }))
  .sort((a, b) => a.name.localeCompare(b.name));

export type LanguageStat = { code: string; name: string; books: number };

/**
 * Books per language, most read first. Books with no language set are counted
 * separately rather than as a language of their own: they are missing data,
 * not a category, and should not compete for the top spot.
 */
export function computeLanguageStats(books: Book[]): { languages: LanguageStat[]; unset: number } {
  const counts = new Map<string, number>();
  let unset = 0;
  for (const book of books) {
    if (!book.language) {
      unset += 1;
      continue;
    }
    counts.set(book.language, (counts.get(book.language) ?? 0) + 1);
  }
  const languages = [...counts]
    .map(([code, n]) => ({ code, name: languageName(code), books: n }))
    .sort((a, b) => b.books - a.books || a.name.localeCompare(b.name));
  return { languages, unset };
}
