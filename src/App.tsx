import { useMemo, useState } from "react";
import { WorldMap } from "./components/WorldMap";
import { CountryPanel } from "./components/CountryPanel";
import { BookList } from "./components/BookList";
import { BooksView } from "./components/BooksView";
import { AddBookDialog } from "./components/AddBookDialog";
import { EditBookDialog } from "./components/EditBookDialog";
import { ImportDialog } from "./components/ImportDialog";
import { LanguagePanel } from "./components/LanguagePanel";
import { useLibrary } from "./lib/store";
import { useAuthorResolution } from "./lib/useResolver";
import {
  computeCountryStats, computeTotals, METRIC_LABELS, METRIC_LABELS_SHORT,
} from "./lib/stats";
import { isFirebaseConfigured, signIn, signOutUser } from "./lib/firebase";
import type { SortDir, SortField } from "./lib/sort";
import { planImport } from "./lib/import";
import { computeLanguageStats, languageName } from "./lib/languages";
import type { Book, Metric } from "./lib/types";
import "./App.css";

const METRICS: Metric[] = ["books", "authors", "avgRating", "pages"];

export default function App() {
  const library = useLibrary();
  const { progress, busy: resolving, retry } = useAuthorResolution(
    library.books,
    library.saveBooks,
  );

  const [metric, setMetric] = useState<Metric>("books");
  const [shelf, setShelf] = useState("read");
  const [selected, setSelected] = useState<string | null>(null);
  const [dialog, setDialog] = useState<"add" | "import" | null>(null);
  const [editing, setEditing] = useState<Book | null>(null);
  const [selected_, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [view, setView] = useState<"map" | "books">("map");
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: "dateRead", dir: "desc",
  });
  /** Books view narrowed to one language; `code: null` means "no language set". */
  const [langFilter, setLangFilter] = useState<{ code: string | null } | null>(null);

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
  const languageCount = useMemo(() => computeLanguageStats(visible).languages.length, [visible]);
  const listed = useMemo(
    () =>
      langFilter ? visible.filter((b) => (b.language ?? null) === langFilter.code) : visible,
    [visible, langFilter],
  );

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

  function goHome() {
    setView("map");
    setSelected(null);
    clearSelection();
  }

  function openBooks(field: SortField, dir: SortDir) {
    setView("books");
    setSelected(null);
    clearSelection();
    setLangFilter(null);
    setSort({ field, dir });
  }

  function openLanguage(code: string | null) {
    openBooks("dateRead", "desc");
    setLangFilter({ code });
  }

  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelectedIds(new Set());

  /**
   * Bulk country assignment. Marked manual so a later automatic pass never
   * overwrites a decision made here.
   */
  async function assignCountry(ids: string[], iso: string) {
    const wanted = new Set(ids);
    const updated = library.books
      .filter((b) => wanted.has(b.id))
      .map((b) => ({
        ...b,
        countryCode: iso,
        countryManual: true,
        status: "resolved" as const,
        note: "set by hand",
        updatedAt: Date.now(),
      }));
    clearSelection();
    await library.saveBooks(updated);
  }

  /** Bulk language assignment; `null` clears it. */
  async function assignLanguage(ids: string[], code: string | null) {
    const wanted = new Set(ids);
    const updated = library.books
      .filter((b) => wanted.has(b.id))
      .map((b) => ({ ...b, language: code, updatedAt: Date.now() }));
    clearSelection();
    await library.saveBooks(updated);
  }

  async function deleteMany(ids: string[]) {
    clearSelection();
    await library.deleteBooks(ids);
  }

  /**
   * A re-import is mostly books we already have; `planImport` keeps their
   * resolved countries and manual overrides so nothing is looked up twice.
   */
  async function importBooks(incoming: Book[], updateExisting: boolean) {
    const plan = planImport(library.books, incoming, updateExisting);
    await library.saveBooks(plan.books);
  }

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

  const selectionProps = {
    selected: selected_,
    onToggle: toggleSelect,
    onSelectAll: (ids: string[]) => setSelectedIds(new Set(ids)),
    onClearSelection: clearSelection,
    onAssignCountry: (ids: string[], iso: string) => void assignCountry(ids, iso),
    onAssignLanguage: (ids: string[], code: string | null) => void assignLanguage(ids, code),
    onDeleteMany: (ids: string[]) => void deleteMany(ids),
    onEdit: setEditing,
    onDelete: (id: string) => void library.deleteBook(id),
  };

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
        <h1>
          <button className="wordmark" onClick={goHome} aria-label="Back to the map">
            📚 bookmappy
          </button>
        </h1>
        <div className="totals">
          {/* Each figure opens the full list, sorted by what you clicked. */}
          <Total value={totals.books} label="books" onClick={() => openBooks("dateRead", "desc")} />
          <Total value={totals.authors} label="authors" onClick={() => openBooks("author", "asc")} />
          <Total value={totals.countries} label="countries" onClick={() => openBooks("country", "asc")} />
          <Total value={languageCount} label="languages" onClick={() => openBooks("language", "asc")} />
          <Total
            value={totals.avgRating ? totals.avgRating.toFixed(2) : "—"}
            label="avg rating"
            onClick={() => openBooks("rating", "desc")}
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

      {library.error && (
        <p className="banner error-banner" role="alert">
          {library.error}
          <button className="ghost small-btn" onClick={library.dismissError}>
            Dismiss
          </button>
        </p>
      )}

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
              <span className="metric-long">{METRIC_LABELS[m]}</span>
              <span className="metric-short">{METRIC_LABELS_SHORT[m]}</span>
            </button>
          ))}
        </div>
        <div className="spacer" />
        {shelves.length > 1 && (
          <select
            value={shelf}
            onChange={(e) => {
              setShelf(e.target.value);
              clearSelection();
            }}
            aria-label="Shelf"
          >
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

      {view === "books" ? (
        <BooksView
          books={listed}
          sort={sort}
          onSort={(field, dir) => setSort({ field, dir })}
          selection={selectionProps}
          filter={
            langFilter
              ? {
                  label: langFilter.code
                    ? `Language: ${languageName(langFilter.code)}`
                    : "No language set",
                  onClear: () => {
                    setLangFilter(null);
                    clearSelection();
                  },
                }
              : undefined
          }
        />
      ) : library.loading ? (
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
        <WorldMap
          stats={stats}
          metric={metric}
          selected={selected}
          onSelect={(iso) => {
            setSelected(iso);
            clearSelection();
          }}
        />
      )}

      {view === "books" ? null : selected && stats.get(selected) ? (
        <CountryPanel
          stat={stats.get(selected)!}
          books={selectedBooks}
          onClose={() => {
            setSelected(null);
            clearSelection();
          }}
          selection={selectionProps}
        />
      ) : (
        library.books.length > 0 && (
          <div className="columns">
            <div className="side-stack">
              <section className="panel">
                <h2>Most read countries</h2>
                <ol className="ranked">
                  {topCountries.map((c) => (
                    <li key={c.code}>
                      <button
                        className="rank-row"
                        onClick={() => {
                          setSelected(c.code);
                          clearSelection();
                        }}
                      >
                        <span className="rank-name">{c.name}</span>
                        <span className="muted small">
                          {c.books} · {c.avgRating ? `${c.avgRating.toFixed(1)}★` : "unrated"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>

              <LanguagePanel books={visible} onPick={openLanguage} />
            </div>

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
                  <button
                    className="ghost"
                    disabled={resolving}
                    onClick={() => void retry(unplaced)}
                  >
                    {resolving ? "Looking up…" : `Retry ${unplaced.length}`}
                  </button>
                </header>
                <BookList books={unplaced} limit={40} showCountry {...selectionProps} />
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
          onImport={importBooks}
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

function Total({
  value, label, onClick,
}: { value: number | string; label: string; onClick: () => void }) {
  return (
    <button className="total" onClick={onClick} title={`Show all books by ${label}`}>
      <strong>{typeof value === "number" ? value.toLocaleString() : value}</strong>
      <span>{label}</span>
    </button>
  );
}
