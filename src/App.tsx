import { useMemo, useState } from "react";
import { WorldMap } from "./components/WorldMap";
import { CountryPanel } from "./components/CountryPanel";
import { BookRow } from "./components/BookRow";
import { AddBookDialog } from "./components/AddBookDialog";
import { EditBookDialog } from "./components/EditBookDialog";
import { ImportDialog } from "./components/ImportDialog";
import { useLibrary } from "./lib/store";
import { useAuthorResolution } from "./lib/useResolver";
import { computeCountryStats, computeTotals, METRIC_LABELS } from "./lib/stats";
import { isFirebaseConfigured, signIn, signOutUser } from "./lib/firebase";
import type { Book, Metric } from "./lib/types";
import "./App.css";

const METRICS: Metric[] = ["books", "authors", "avgRating", "pages"];

export default function App() {
  const library = useLibrary();
  const { progress, retryAll } = useAuthorResolution(library.books, library.saveBooks);

  const [metric, setMetric] = useState<Metric>("books");
  const [shelf, setShelf] = useState("read");
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);

  const shelves = useMemo(
    () => [...new Set(library.books.map((b) => b.shelf))].sort(),
    [library.books],
  );
  const visible = useMemo(
    () => (shelf === "all" ? library.books : library.books.filter((b) => b.shelf === shelf)),
    [library.books, shelf],
  );
  const stats = useMemo(() => computeCountryStats(visible), [visible]);
  const totals = useMemo(() => computeTotals(visible, stats), [visible, stats]);

  const selectedBooks = useMemo(
    () =>
      selected
        ? visible
            .filter((b) => b.countryCode === selected)
            .sort((a, b) => (b.dateRead ?? "").localeCompare(a.dateRead ?? ""))
        : [],
    [visible, selected],
  );
  const unplaced = useMemo(() => visible.filter((b) => !b.countryCode), [visible]);
  const topCountries = useMemo(
    () => [...stats.values()].sort((a, b) => b.books - a.books).slice(0, 12),
    [stats],
  );

  async function addBook(book: Book) {
    setDialog(null);
    await library.saveBooks([book]);
  }

  async function saveEdit(book: Book) {
    setEditing(null);
    await library.saveBooks([book]);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(library.books, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bookmappy-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (library.needsSignIn) {
    return (
      <main className="signin">
        <h1>📚 bookmappy</h1>
        <p>Read the world, one country at a time.</p>
        <button className="primary big" onClick={() => void signIn()}>
          Sign in with Google
        </button>
      </main>
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>📚 bookmappy</h1>
        <div className="totals">
          <Total value={totals.books} label="books" />
          <Total value={totals.authors} label="authors" />
          <Total value={totals.countries} label="countries" />
          <Total
            value={totals.avgRating ? totals.avgRating.toFixed(2) : "—"}
            label="avg rating"
          />
        </div>
        <div className="topbar-actions">
          {isFirebaseConfigured && library.user && (
            <button className="ghost" onClick={() => void signOutUser()}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {library.localOnly && (
        <p className="banner">
          Saving to this browser only — Firebase is not configured, so your library will not
          follow you to another device. See <code>SETUP.md</code>.
        </p>
      )}

      <div className="toolbar">
        <div className="segmented" role="group" aria-label="Colour the map by">
          {METRICS.map((m) => (
            <button
              key={m}
              className={metric === m ? "active" : ""}
              onClick={() => setMetric(m)}
            >
              {METRIC_LABELS[m]}
            </button>
          ))}
        </div>
        <div className="spacer" />
        {shelves.length > 1 && (
          <select value={shelf} onChange={(e) => setShelf(e.target.value)} aria-label="Shelf">
            <option value="all">all shelves</option>
            {shelves.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <button className="ghost" onClick={() => setDialog("import")}>
          Import Goodreads
        </button>
        <button className="ghost" onClick={() => setDialog("add")}>
          Add book
        </button>
        <button className="ghost" onClick={exportJson} disabled={library.books.length === 0}>
          Export
        </button>
      </div>

      {progress && (
        <p className="banner progress">
          Looking up author countries… {progress.done}/{progress.total}
        </p>
      )}

      {library.loading ? (
        <p className="empty">Loading your library…</p>
      ) : library.books.length === 0 ? (
        <div className="empty">
          <h2>Your map is blank.</h2>
          <p>Import your Goodreads export, or add a book by hand, and countries start filling in.</p>
          <button className="primary" onClick={() => setDialog("import")}>
            Import from Goodreads
          </button>
        </div>
      ) : (
        <WorldMap stats={stats} metric={metric} selected={selected} onSelect={setSelected} />
      )}

      {selected && stats.get(selected) ? (
        <CountryPanel
          stat={stats.get(selected)!}
          books={selectedBooks}
          onClose={() => setSelected(null)}
          onEdit={setEditing}
          onDelete={(id) => void library.deleteBook(id)}
        />
      ) : (
        library.books.length > 0 && (
          <div className="columns">
            <section className="panel">
              <h2>Most read countries</h2>
              <ol className="ranked">
                {topCountries.map((c) => (
                  <li key={c.code}>
                    <button className="rank-row" onClick={() => setSelected(c.code)}>
                      <span className="rank-name">{c.name}</span>
                      <span className="muted small">
                        {c.books} · {c.avgRating ? `${c.avgRating.toFixed(1)}★` : "unrated"}
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>

            {unplaced.length > 0 && (
              <section className="panel">
                <header className="panel-head">
                  <div>
                    <h2>Not on the map ({unplaced.length})</h2>
                    <p className="muted small">
                      Wikidata could not place these authors. Set a country by hand and they join
                      the map.
                    </p>
                  </div>
                  <button className="ghost" onClick={retryAll}>
                    Retry lookup
                  </button>
                </header>
                <ul className="book-list">
                  {unplaced.slice(0, 40).map((book) => (
                    <BookRow
                      key={book.id}
                      book={book}
                      showCountry
                      onEdit={setEditing}
                      onDelete={(id) => void library.deleteBook(id)}
                    />
                  ))}
                </ul>
              </section>
            )}
          </div>
        )
      )}

      {dialog === "add" && (
        <AddBookDialog onAdd={(b) => void addBook(b)} onClose={() => setDialog(null)} />
      )}
      {dialog === "import" && (
        <ImportDialog
          existing={library.books}
          onImport={library.saveBooks}
          onClose={() => setDialog(null)}
        />
      )}
      {editing && (
        // Keyed by book so switching rows remounts with a fresh draft rather
        // than syncing the prop into state.
        <EditBookDialog
          key={editing.id}
          book={editing}
          onSave={(b) => void saveEdit(b)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Total({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="total">
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      <span>{label}</span>
    </div>
  );
}
