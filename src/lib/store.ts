import { useCallback, useEffect, useMemo, useState } from "react";
import {
  collection, deleteDoc, doc, onSnapshot, writeBatch,
} from "firebase/firestore";
import { db, isFirebaseConfigured, watchAuth, type User } from "./firebase";
import type { Book } from "./types";

const LOCAL_KEY = "bookmappy.books.v1";
/** Firestore caps a batch at 500 writes. */
const BATCH_LIMIT = 400;

function readLocal(): Book[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return raw ? (JSON.parse(raw) as Book[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(books: Book[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(books));
  } catch {
    // Quota exhausted; the in-memory copy still works for this session.
  }
}

/**
 * Turn a Firestore error into something actionable. `permission-denied` almost
 * always means the security rules were never published — the console leaves new
 * databases denying everything — so name that cause instead of echoing the SDK.
 */
function describe(err: unknown, action: string): string {
  const code = (err as { code?: string })?.code ?? "";
  if (code.includes("permission-denied")) {
    return `Firestore refused the ${action}. Publish the rules from firestore.rules in the Firebase console (Firestore Database -> Rules); a new database denies everything until you do.`;
  }
  if (code.includes("unavailable")) return `Could not reach Firestore to ${action}. Check your connection.`;
  return `Could not ${action} to Firestore: ${(err as Error)?.message ?? code ?? "unknown error"}`;
}

export type LibraryState = {
  books: Book[];
  loading: boolean;
  /** Last storage failure, surfaced in the UI. Writes must never fail silently. */
  error: string | null;
  dismissError: () => void;
  user: User | null;
  /** True when writes go to this browser only, because Firebase is unconfigured. */
  localOnly: boolean;
  needsSignIn: boolean;
  saveBooks: (books: Book[]) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  deleteBooks: (ids: string[]) => Promise<void>;
  clearAll: () => Promise<void>;
};

export function useLibrary(): LibraryState {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [books, setBooks] = useState<Book[]>(() => (isFirebaseConfigured ? [] : readLocal()));
  /** uid whose library has finished its first load; drives `loading` by derivation. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return watchAuth((next) => {
      setUser(next);
      setAuthReady(true);
    });
  }, []);

  // Firestore streams the library, so an edit on the phone shows up on the
  // laptop without a refresh.
  useEffect(() => {
    if (!isFirebaseConfigured || !user) return;
    const ref = collection(db(), "users", user.uid, "books");
    return onSnapshot(
      ref,
      (snap) => {
        setBooks(snap.docs.map((d) => d.data() as Book));
        setLoadedFor(user.uid);
        setError(null);
      },
      (err) => {
        setLoadedFor(user.uid);
        setError(describe(err, "read"));
      },
    );
  }, [user]);

  const saveBooks = useCallback(
    async (incoming: Book[]) => {
      if (incoming.length === 0) return;
      if (!isFirebaseConfigured || !user) {
        setBooks((prev) => {
          const merged = new Map(prev.map((b) => [b.id, b]));
          for (const b of incoming) merged.set(b.id, b);
          const next = [...merged.values()];
          writeLocal(next);
          return next;
        });
        return;
      }
      const ref = collection(db(), "users", user.uid, "books");
      try {
        for (let i = 0; i < incoming.length; i += BATCH_LIMIT) {
          const batch = writeBatch(db());
          for (const book of incoming.slice(i, i + BATCH_LIMIT)) {
            batch.set(doc(ref, book.id), book);
          }
          await batch.commit();
        }
        setError(null);
      } catch (err) {
        setError(describe(err, "save"));
      }
    },
    [user],
  );

  const deleteBook = useCallback(
    async (id: string) => {
      if (!isFirebaseConfigured || !user) {
        setBooks((prev) => {
          const next = prev.filter((b) => b.id !== id);
          writeLocal(next);
          return next;
        });
        return;
      }
      try {
        await deleteDoc(doc(db(), "users", user.uid, "books", id));
        setError(null);
      } catch (err) {
        setError(describe(err, "delete"));
      }
    },
    [user],
  );

  const deleteBooks = useCallback(
    async (ids: string[]) => {
      if (ids.length === 0) return;
      if (!isFirebaseConfigured || !user) {
        setBooks((prev) => {
          const doomed = new Set(ids);
          const next = prev.filter((b) => !doomed.has(b.id));
          writeLocal(next);
          return next;
        });
        return;
      }
      const ref = collection(db(), "users", user.uid, "books");
      try {
        for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
          const batch = writeBatch(db());
          for (const id of ids.slice(i, i + BATCH_LIMIT)) batch.delete(doc(ref, id));
          await batch.commit();
        }
        setError(null);
      } catch (err) {
        setError(describe(err, "delete"));
      }
    },
    [user],
  );

  const clearAll = useCallback(async () => {
    if (!isFirebaseConfigured || !user) {
      setBooks([]);
      writeLocal([]);
      return;
    }
    const ref = collection(db(), "users", user.uid, "books");
    try {
      for (let i = 0; i < books.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db());
        for (const book of books.slice(i, i + BATCH_LIMIT)) batch.delete(doc(ref, book.id));
        await batch.commit();
      }
      setError(null);
    } catch (err) {
      setError(describe(err, "delete"));
    }
  }, [user, books]);

  const loading = !authReady || (isFirebaseConfigured && user !== null && loadedFor !== user.uid);

  return useMemo(
    () => ({
      books,
      loading,
      error,
      dismissError: () => setError(null),
      user,
      localOnly: !isFirebaseConfigured,
      needsSignIn: isFirebaseConfigured && authReady && !user,
      saveBooks,
      deleteBook,
      deleteBooks,
      clearAll,
    }),
    [books, loading, error, authReady, user, saveBooks, deleteBook, deleteBooks, clearAll],
  );
}
