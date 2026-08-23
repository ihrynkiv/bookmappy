import Papa from "papaparse";
import type { Book } from "./types";

/**
 * Goodreads shut its API down in 2020, so the only way in is the CSV export
 * from goodreads.com/review/import. These are the columns it produces.
 */
type Row = Record<string, string>;

/** Goodreads writes ISBNs as `="0439023483"` to stop Excel eating leading zeros. */
function cleanIsbn(raw: string | undefined): string | null {
  const value = (raw ?? "").replace(/^="?|"?$/g, "").trim();
  return value.length >= 10 ? value : null;
}

/** Export dates look like `2016/03/13`; normalise to ISO so they sort as text. */
function cleanDate(raw: string | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  const match = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (match) {
    const [, y, m, d] = match;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
}

function num(raw: string | undefined): number | null {
  const n = Number((raw ?? "").trim());
  return Number.isFinite(n) && n > 0 ? n : null;
}

export type ParsedImport = {
  books: Book[];
  skipped: number;
  detectedShelves: string[];
};

/**
 * Turn an export into books. Everything on every shelf is kept — the UI filters
 * by shelf — but rows without a title or author are useless and get dropped.
 */
export function parseGoodreadsCsv(csv: string): ParsedImport {
  const { data } = Papa.parse<Row>(csv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  });

  const books: Book[] = [];
  const shelves = new Set<string>();
  let skipped = 0;
  const now = Date.now();

  for (const row of data) {
    const title = (row["Title"] ?? "").trim();
    const author = (row["Author"] ?? "").trim();
    if (!title || !author) {
      skipped += 1;
      continue;
    }
    const shelf = (row["Exclusive Shelf"] ?? "read").trim() || "read";
    shelves.add(shelf);
    const rating = Number((row["My Rating"] ?? "0").trim());
    const isbn = cleanIsbn(row["ISBN13"]) ?? cleanIsbn(row["ISBN"]);

    books.push({
      id: `gr-${(row["Book Id"] ?? "").trim() || crypto.randomUUID()}`,
      title,
      author,
      rating: rating >= 1 && rating <= 5 ? rating : null,
      dateRead: cleanDate(row["Date Read"]) ?? cleanDate(row["Date Added"]),
      pages: num(row["Number of Pages"]),
      isbn,
      coverUrl: isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg` : null,
      shelf,
      authorQid: null,
      countryCode: null,
      countryManual: false,
      status: "pending",
      note: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  return { books, skipped, detectedShelves: [...shelves].sort() };
}
