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

export type LibraryState = {
  books: Book[];
  loading: boolean;
  user: User | null;
  /** True when writes go to this browser only, because Firebase is unconfigured. */
  localOnly: boolean;
  needsSignIn: boolean;
  saveBooks: (books: Book[]) => Promise<void>;
  deleteBook: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
};

export function useLibrary(): LibraryState {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isFirebaseConfigured);
  const [books, setBooks] = useState<Book[]>(() => (isFirebaseConfigured ? [] : readLocal()));
  /** uid whose library has finished its first load; drives `loading` by derivation. */
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

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
      },
      () => setLoadedFor(user.uid),
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
      for (let i = 0; i < incoming.length; i += BATCH_LIMIT) {
        const batch = writeBatch(db());
        for (const book of incoming.slice(i, i + BATCH_LIMIT)) {
          batch.set(doc(ref, book.id), book);
        }
        await batch.commit();
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
      await deleteDoc(doc(db(), "users", user.uid, "books", id));
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
    for (let i = 0; i < books.length; i += BATCH_LIMIT) {
      const batch = writeBatch(db());
      for (const book of books.slice(i, i + BATCH_LIMIT)) batch.delete(doc(ref, book.id));
      await batch.commit();
    }
  }, [user, books]);

  const loading = !authReady || (isFirebaseConfigured && user !== null && loadedFor !== user.uid);

  return useMemo(
    () => ({
      books,
      loading,
      user,
      localOnly: !isFirebaseConfigured,
      needsSignIn: isFirebaseConfigured && authReady && !user,
      saveBooks,
      deleteBook,
      clearAll,
    }),
    [books, loading, authReady, user, saveBooks, deleteBook, clearAll],
  );
}
