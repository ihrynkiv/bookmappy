import type { Book } from "./types";
import { countryName } from "./geo";
import { languageName } from "./languages";

export type SortField = "dateRead" | "rating" | "title" | "author" | "country" | "language";
export type SortDir = "asc" | "desc";

export const SORT_LABELS: Record<SortField, string> = {
  dateRead: "Date read",
  rating: "Rating",
  title: "Title",
  author: "Author",
  country: "Country",
  language: "Language",
};

/** Default direction per field: newest and best-rated first feel right. */
export const DEFAULT_DIR: Record<SortField, SortDir> = {
  dateRead: "desc",
  rating: "desc",
  title: "asc",
  author: "asc",
  country: "asc",
  language: "asc",
};

function key(book: Book, field: SortField): string | number | null {
  switch (field) {
    case "dateRead": return book.dateRead;
    case "rating": return book.rating;
    case "title": return book.title.toLocaleLowerCase();
    case "author": return book.author.toLocaleLowerCase();
    case "country": return book.countryCode ? countryName(book.countryCode) : null;
    case "language": return book.language ? languageName(book.language) : null;
  }
}

/**
 * Sort a book list. Missing values always sink to the bottom rather than
 * flipping with the direction — an unrated book is not "the worst book", and
 * burying it is more useful than ranking it.
 */
export function sortBooks(books: Book[], field: SortField, dir: SortDir): Book[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...books].sort((a, b) => {
    const ka = key(a, field);
    const kb = key(b, field);
    if (ka === null && kb === null) return a.title.localeCompare(b.title);
    if (ka === null) return 1;
    if (kb === null) return -1;
    const cmp =
      typeof ka === "number" && typeof kb === "number"
        ? ka - kb
        : String(ka).localeCompare(String(kb));
    return cmp !== 0 ? cmp * sign : a.title.localeCompare(b.title);
  });
}
