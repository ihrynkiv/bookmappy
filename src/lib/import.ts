import type { Book } from "./types";

export type MergePlan = {
  /** Books to write: everything new, plus existing books that actually changed. */
  books: Book[];
  added: number;
  updated: number;
  unchanged: number;
  skipped: number;
};

/** Fields a re-export can legitimately refresh. Everything else is ours. */
function readingFieldsChanged(prev: Book, next: Book): boolean {
  return (
    prev.rating !== next.rating ||
    prev.dateRead !== next.dateRead ||
    prev.shelf !== next.shelf ||
    prev.title !== next.title ||
    prev.author !== next.author ||
    (next.pages ?? prev.pages) !== prev.pages
  );
}

/**
 * Work out what a Goodreads re-import should actually write.
 *
 * The point of re-importing a year later is the handful of new books, so a book
 * already in the library keeps its resolution — `authorQid`, `countryCode`,
 * `countryManual`, `status`, `note` are never touched. Overwriting them would
 * both discard every country you fixed by hand and send hundreds of already
 * answered authors back to Wikidata.
 *
 * Ratings, dates and shelves are still refreshed, so a book that moved from
 * to-read to read catches up. With `updateExisting` false, known books are
 * skipped outright.
 *
 * The one exception is a changed author name: the stored country was derived
 * from the old name, so resolution restarts — unless it was set by hand, in
 * which case the human wins.
 */
export function planImport(
  existing: Book[],
  incoming: Book[],
  updateExisting: boolean,
): MergePlan {
  const known = new Map(existing.map((b) => [b.id, b]));
  const books: Book[] = [];
  let added = 0;
  let updated = 0;
  let unchanged = 0;
  let skipped = 0;

  for (const book of incoming) {
    const prev = known.get(book.id);
    if (!prev) {
      books.push(book);
      added += 1;
      continue;
    }
    if (!updateExisting) {
      skipped += 1;
      continue;
    }
    if (!readingFieldsChanged(prev, book)) {
      unchanged += 1;
      continue;
    }

    const authorChanged = prev.author !== book.author;
    const reresolve = authorChanged && !prev.countryManual;
    books.push({
      ...prev,
      title: book.title,
      author: book.author,
      rating: book.rating,
      dateRead: book.dateRead,
      shelf: book.shelf,
      pages: book.pages ?? prev.pages,
      isbn: book.isbn ?? prev.isbn,
      coverUrl: prev.coverUrl ?? book.coverUrl,
      ...(reresolve
        ? { authorQid: null, countryCode: null, status: "pending" as const, note: null }
        : {}),
      updatedAt: Date.now(),
    });
    updated += 1;
  }

  return { books, added, updated, unchanged, skipped };
}
