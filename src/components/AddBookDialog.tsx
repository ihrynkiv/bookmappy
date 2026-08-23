import { useEffect, useRef, useState } from "react";
import { searchBooks, type BookSearchResult } from "../lib/openlibrary";
import type { Book } from "../lib/types";
import { Dialog } from "./Dialog";

type Props = { onAdd: (book: Book) => void; onClose: () => void };

const blank = (): Book => ({
  id: crypto.randomUUID(),
  title: "",
  author: "",
  rating: null,
  dateRead: new Date().toISOString().slice(0, 10),
  pages: null,
  isbn: null,
  coverUrl: null,
  shelf: "read",
  authorQid: null,
  countryCode: null,
  countryManual: false,
  status: "pending",
  note: null,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export function AddBookDialog({ onAdd, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<BookSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [draft, setDraft] = useState<Book>(blank);
  const abort = useRef<AbortController | null>(null);

  // Debounced so typing a title does not fire a request per keystroke.
  useEffect(() => {
    if (query.trim().length < 3) return;
    const timer = setTimeout(async () => {
      abort.current?.abort();
      const controller = new AbortController();
      abort.current = controller;
      setSearching(true);
      try {
        setResults(await searchBooks(query.trim(), controller.signal));
      } catch {
        // Aborted or offline — leave the previous results in place.
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  function pick(result: BookSearchResult) {
    setDraft((d) => ({
      ...d,
      title: result.title,
      author: result.author,
      pages: result.pages,
      isbn: result.isbn,
      coverUrl: result.coverUrl,
    }));
    setResults([]);
    setQuery("");
  }

  // Derived rather than cleared in the effect: a query too short to search
  // simply shows nothing, without an extra render pass.
  const visibleResults = query.trim().length >= 3 ? results : [];
  const ready = draft.title.trim() && draft.author.trim();

  return (
    <Dialog title="Add a book" onClose={onClose} wide>
      <div className="field">
        <label htmlFor="add-search">Search Open Library</label>
        <input
          id="add-search"
          value={query}
          placeholder="Title, or title and author"
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        {searching && <span className="muted small">Searching…</span>}
      </div>

      {visibleResults.length > 0 && (
        <ul className="results">
          {visibleResults.map((r) => (
            <li key={r.key}>
              <button className="result" onClick={() => pick(r)}>
                {r.coverUrl ? (
                  <img src={r.coverUrl} alt="" className="cover small" loading="lazy" />
                ) : (
                  <span className="cover small cover-missing" />
                )}
                <span>
                  <strong>{r.title}</strong>
                  <span className="muted small">
                    {r.author}
                    {r.year && ` · ${r.year}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="row">
        <div className="field grow">
          <label htmlFor="add-title">Title</label>
          <input
            id="add-title"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </div>
        <div className="field grow">
          <label htmlFor="add-author">Author</label>
          <input
            id="add-author"
            value={draft.author}
            onChange={(e) => setDraft({ ...draft, author: e.target.value })}
          />
        </div>
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="add-rating">Rating</label>
          <select
            id="add-rating"
            value={draft.rating ?? 0}
            onChange={(e) => setDraft({ ...draft, rating: Number(e.target.value) || null })}
          >
            <option value={0}>Unrated</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="add-date">Date read</label>
          <input
            id="add-date"
            type="date"
            value={draft.dateRead ?? ""}
            onChange={(e) => setDraft({ ...draft, dateRead: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label htmlFor="add-shelf">Shelf</label>
          <select
            id="add-shelf"
            value={draft.shelf}
            onChange={(e) => setDraft({ ...draft, shelf: e.target.value })}
          >
            <option value="read">read</option>
            <option value="currently-reading">currently-reading</option>
            <option value="to-read">to-read</option>
          </select>
        </div>
      </div>

      <footer className="dialog-actions">
        <span className="muted small">The author's country is looked up automatically.</span>
        <div>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={!ready} onClick={() => onAdd(draft)}>
            Add book
          </button>
        </div>
      </footer>
    </Dialog>
  );
}
