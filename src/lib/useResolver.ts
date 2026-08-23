import { useEffect, useRef, useState } from "react";
import { resolveAuthors } from "./wikidata";
import type { Book } from "./types";

export type ResolveProgress = { done: number; total: number } | null;

/**
 * Watches the library for books whose author has never been looked up and
 * resolves them in the background.
 *
 * Two things keep this cheap. Authors already placed elsewhere in the library
 * are copied straight across without a network call — importing 300 books by
 * 180 authors, half of whom you have read before, only queries the new ones.
 * And names already attempted in this session are remembered, so a name
 * Wikidata does not know is not retried on every render.
 */
export function useAuthorResolution(books: Book[], saveBooks: (books: Book[]) => Promise<void>) {
  const [progress, setProgress] = useState<ResolveProgress>(null);
  const attempted = useRef(new Set<string>());
  const running = useRef(false);

  useEffect(() => {
    if (running.current) return;

    const pending = books.filter(
      (b) => b.status === "pending" && !b.countryManual && !attempted.current.has(b.author),
    );
    if (pending.length === 0) return;

    const known = new Map<string, Book>();
    for (const book of books) {
      if (book.status === "resolved" && book.countryCode && !known.has(book.author)) {
        known.set(book.author, book);
      }
    }

    const copied: Book[] = [];
    const toQuery: string[] = [];
    for (const book of pending) {
      const match = known.get(book.author);
      if (match) {
        copied.push({
          ...book,
          authorQid: match.authorQid,
          countryCode: match.countryCode,
          status: "resolved",
          note: match.note,
          updatedAt: Date.now(),
        });
      } else if (!toQuery.includes(book.author)) {
        toQuery.push(book.author);
      }
    }

    running.current = true;
    void (async () => {
      try {
        if (copied.length > 0) await saveBooks(copied);
        if (toQuery.length === 0) return;

        setProgress({ done: 0, total: toQuery.length });
        const resolutions = await resolveAuthors(toQuery, (done, total) =>
          setProgress({ done, total }),
        );

        const updates: Book[] = [];
        for (const book of pending) {
          const result = resolutions.get(book.author);
          if (!result) continue;
          // A failed batch stays "pending" so the retry button can pick it up.
          if (result.status !== "pending") attempted.current.add(book.author);
          updates.push({
            ...book,
            authorQid: result.qid,
            countryCode: result.countryCode,
            status: result.status,
            note: result.note,
            updatedAt: Date.now(),
          });
        }
        if (updates.length > 0) await saveBooks(updates);
      } finally {
        running.current = false;
        setProgress(null);
      }
    })();
  }, [books, saveBooks]);

  /** Clears the "already tried" memory so the next pass re-queries everything. */
  const retryAll = () => attempted.current.clear();

  return { progress, retryAll };
}
