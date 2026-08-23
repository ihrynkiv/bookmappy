import type { Book, CountryStat, Metric } from "./types";
import { countryName } from "./geo";

export const METRIC_LABELS: Record<Metric, string> = {
  books: "Books read",
  authors: "Distinct authors",
  avgRating: "Average rating",
  pages: "Pages read",
};

/** Abbreviations for narrow screens, where the full names do not fit. */
export const METRIC_LABELS_SHORT: Record<Metric, string> = {
  books: "Books",
  authors: "Authors",
  avgRating: "Rating",
  pages: "Pages",
};

export function computeCountryStats(books: Book[]): Map<string, CountryStat> {
  const stats = new Map<string, CountryStat>();
  const authorsByCountry = new Map<string, Set<string>>();

  for (const book of books) {
    const code = book.countryCode;
    if (!code) continue;
    let stat = stats.get(code);
    if (!stat) {
      stat = {
        code, name: countryName(code), books: 0, authors: 0,
        ratedBooks: 0, avgRating: null, pages: 0,
      };
      stats.set(code, stat);
      authorsByCountry.set(code, new Set());
    }
    stat.books += 1;
    stat.pages += book.pages ?? 0;
    if (book.rating) {
      stat.ratedBooks += 1;
      stat.avgRating = (stat.avgRating ?? 0) + book.rating;
    }
    authorsByCountry.get(code)!.add(book.author.toLowerCase());
  }

  for (const [code, stat] of stats) {
    stat.authors = authorsByCountry.get(code)?.size ?? 0;
    if (stat.avgRating !== null && stat.ratedBooks > 0) {
      stat.avgRating = stat.avgRating / stat.ratedBooks;
    }
  }
  return stats;
}

export function metricValue(stat: CountryStat | undefined, metric: Metric): number | null {
  if (!stat) return null;
  switch (metric) {
    case "books": return stat.books;
    case "authors": return stat.authors;
    case "pages": return stat.pages || null;
    case "avgRating": return stat.avgRating;
  }
}

export function formatMetric(value: number | null, metric: Metric): string {
  if (value === null) return "—";
  if (metric === "avgRating") return `${value.toFixed(2)} ★`;
  return value.toLocaleString();
}

export type Totals = {
  books: number;
  authors: number;
  countries: number;
  pages: number;
  avgRating: number | null;
  unplaced: number;
};

export function computeTotals(books: Book[], stats: Map<string, CountryStat>): Totals {
  const rated = books.filter((b) => b.rating);
  return {
    books: books.length,
    authors: new Set(books.map((b) => b.author.toLowerCase())).size,
    countries: stats.size,
    pages: books.reduce((sum, b) => sum + (b.pages ?? 0), 0),
    avgRating: rated.length ? rated.reduce((s, b) => s + (b.rating ?? 0), 0) / rated.length : null,
    unplaced: books.filter((b) => !b.countryCode).length,
  };
}
