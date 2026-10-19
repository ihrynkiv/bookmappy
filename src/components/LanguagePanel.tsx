import { useMemo } from "react";
import { computeLanguageStats } from "../lib/languages";
import type { Book } from "../lib/types";

type Props = {
  books: Book[];
  /** Open the book list filtered to one language; `null` means "not set". */
  onPick: (code: string | null) => void;
};

/** Rows drawn before the long tail is summarised. */
const TOP = 10;

/**
 * Books per reading language as a ranked bar chart. One series, so one colour
 * and no legend; every bar is labelled with its count and share directly.
 * Untagged books are shown apart, as a to-do rather than a language.
 */
export function LanguagePanel({ books, onPick }: Props) {
  const { languages, unset } = useMemo(() => computeLanguageStats(books), [books]);
  const tagged = books.length - unset;
  const max = languages[0]?.books ?? 0;
  const shown = languages.slice(0, TOP);
  const rest = languages.slice(TOP);
  const pct = (n: number) => (tagged ? Math.round((n / tagged) * 100) : 0);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>Languages</h2>
          <p className="muted small">
            {languages.length > 0
              ? `${languages.length} ${languages.length === 1 ? "language" : "languages"} · ${tagged} of ${books.length} books tagged`
              : "Goodreads does not export a language, so tag books here."}
          </p>
        </div>
      </header>

      {languages.length === 0 ? (
        <p className="muted small">
          Select books in any list and use <strong>Set language to…</strong>, or pick one when
          adding or editing a book.
        </p>
      ) : (
        <ol className="lang-bars">
          {shown.map((l) => (
            <li key={l.code}>
              <button
                className="lang-row"
                onClick={() => onPick(l.code)}
                title={`${l.name}: ${l.books} ${l.books === 1 ? "book" : "books"} (${pct(l.books)}% of tagged)`}
              >
                <span className="lang-name">{l.name}</span>
                <span className="lang-track" aria-hidden="true">
                  <span className="lang-bar" style={{ width: `${(l.books / max) * 100}%` }} />
                </span>
                <span className="lang-value">
                  {l.books} <span className="muted">· {pct(l.books)}%</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}

      {rest.length > 0 && (
        <p className="muted small">
          + {rest.length} more: {rest.map((l) => `${l.name} (${l.books})`).join(", ")}
        </p>
      )}

      {unset > 0 && (
        <button className="ghost lang-unset" onClick={() => onPick(null)}>
          {unset} {unset === 1 ? "book has" : "books have"} no language — tag them
        </button>
      )}
    </section>
  );
}
