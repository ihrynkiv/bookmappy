import { useMemo } from "react";
import { BookList } from "./BookList";
import { DEFAULT_DIR, SORT_LABELS, sortBooks, type SortDir, type SortField } from "../lib/sort";
import type { Book } from "../lib/types";
import type { ComponentProps } from "react";

const FIELDS: SortField[] = ["dateRead", "rating", "title", "author", "country"];

type Props = {
  books: Book[];
  sort: { field: SortField; dir: SortDir };
  onSort: (field: SortField, dir: SortDir) => void;
  selection: Omit<ComponentProps<typeof BookList>, "books" | "showCountry" | "limit">;
};

export function BooksView({ books, sort, onSort, selection }: Props) {
  const sorted = useMemo(() => sortBooks(books, sort.field, sort.dir), [books, sort]);

  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>All books ({books.length})</h2>
          <p className="muted small">Sort, filter by shelf, and fix countries in bulk.</p>
        </div>
      </header>

      <div className="sort-bar" role="group" aria-label="Sort books by">
        {FIELDS.map((field) => {
          const active = sort.field === field;
          return (
            <button
              key={field}
              className={`sort-btn${active ? " active" : ""}`}
              aria-pressed={active}
              onClick={() =>
                // Clicking the active field flips direction; a new field starts
                // at whichever direction is most useful for it.
                onSort(
                  field,
                  active ? (sort.dir === "asc" ? "desc" : "asc") : DEFAULT_DIR[field],
                )
              }
            >
              {SORT_LABELS[field]}
              {active && <span className="sort-arrow">{sort.dir === "asc" ? "↑" : "↓"}</span>}
            </button>
          );
        })}
      </div>

      <BookList books={sorted} showCountry {...selection} />
    </section>
  );
}
