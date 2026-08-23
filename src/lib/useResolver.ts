import { useCallback, useEffect, useRef, useState } from "react";
import { resolveAuthors } from "./wikidata";
import type { Book } from "./types";

export type ResolveProgress = { done: number; total: number } | null;

/**
 * Resolves author countries in the background, and on demand.
 *
 * Two things keep it cheap. Authors already placed elsewhere in the library are
 * copied across without a network call — importing 300 books by 180 authors,
 * half of whom you have read before, only queries the new ones. And every name
 * attempted in this session is remembered, so a name Wikidata cannot place is
 * not asked about again on the next render.
 *
 * That memory is why retrying has to be explicit: unresolved books sit at
 * `not-found` or `no-country`, which the automatic pass deliberately ignores.
 * `retry` clears the memory for the names it is given and resolves them
 * directly, whatever their status.
 */
export function useAuthorResolution(books: Book[], saveBooks: (books: Book[]) => Promise<void>) {
  const [progress, setProgress] = useState<ResolveProgress>(null);
  const [busy, setBusy] = useState(false);
  const attempted = useRef(new Set<string>());
  const running = useRef(false);

  /**
   * `library` is passed in rather than read from a ref so nothing is written
   * during render; it is only needed to find authors already placed elsewhere.
   */
  const resolve = useCallback(
    async (targets: Book[], library: Book[]) => {
      if (running.current || targets.length === 0) return;
      running.current = true;
      setBusy(true);
      try {
        const known = new Map<string, Book>();
        for (const book of library) {
          if (book.status === "resolved" && book.countryCode && !known.has(book.author)) {
            known.set(book.author, book);
          }
        }

        const copied: Book[] = [];
        const toQuery: string[] = [];
        for (const book of targets) {
          const match = known.get(book.author);
          if (match && match.id !== book.id) {
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

        if (copied.length > 0) await saveBooks(copied);
        if (toQuery.length === 0) return;

        setProgress({ done: 0, total: toQuery.length });
        const resolutions = await resolveAuthors(toQuery, (done, total) =>
          setProgress({ done, total }),
        );

        const updates: Book[] = [];
        for (const book of targets) {
          const result = resolutions.get(book.author);
          if (!result) continue;
          // Always remembered, including after a failed batch. Leaving a failure
          // unrecorded would let the automatic pass re-fire on the next render
          // and hammer Wikidata in a loop; `retry` is the way back in.
          attempted.current.add(book.author);
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
        setBusy(false);
      }
    },
    [saveBooks],
  );

  // Automatic pass: only books never looked up before.
  useEffect(() => {
    const pending = books.filter(
      (b) => b.status === "pending" && !b.countryManual && !attempted.current.has(b.author),
    );
    if (pending.length > 0) void resolve(pending, books);
  }, [books, resolve]);

  /**
   * Look these books up again regardless of status. Manual countries are left
   * alone — a human already answered that question.
   */
  const retry = useCallback(
    async (targets: Book[]) => {
      const eligible = targets.filter((b) => !b.countryManual);
      for (const book of eligible) attempted.current.delete(book.author);
      await resolve(eligible, books);
    },
    [resolve, books],
  );

  return { progress, busy, retry };
}
