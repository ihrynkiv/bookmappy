import { ALL_COUNTRIES } from "../lib/geo";
import type { Book } from "../lib/types";
import { BookRow } from "./BookRow";

type Props = {
  books: Book[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onSelectAll: (ids: string[]) => void;
  onClearSelection: () => void;
  onAssignCountry: (ids: string[], iso: string) => void;
  onDeleteMany: (ids: string[]) => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  showCountry?: boolean;
  /** Cap on rows drawn; the rest stay selectable through "select all". */
  limit?: number;
};

/**
 * A selectable list of books. The bulk bar is the fast path for the common
 * repair job: a batch of authors Wikidata could not place that all belong to
 * the same country.
 */
export function BookList({
  books, selected, onToggle, onSelectAll, onClearSelection,
  onAssignCountry, onDeleteMany, onEdit, onDelete, showCountry, limit,
}: Props) {
  const visible = limit ? books.slice(0, limit) : books;
  const ids = books.map((b) => b.id);
  const chosen = ids.filter((id) => selected.has(id));
  const allSelected = ids.length > 0 && chosen.length === ids.length;

  return (
    <>
      <div className="list-tools">
        <label className="check">
          <input
            type="checkbox"
            checked={allSelected}
            // Indeterminate is the honest state for a partial selection.
            ref={(el) => {
              if (el) el.indeterminate = chosen.length > 0 && !allSelected;
            }}
            onChange={() => (allSelected ? onClearSelection() : onSelectAll(ids))}
          />
          <span className="muted small">
            {chosen.length > 0 ? `${chosen.length} selected` : `Select all ${ids.length}`}
          </span>
        </label>
      </div>

      {chosen.length > 0 && (
        <div className="bulk-bar">
          <span>
            <strong>{chosen.length}</strong> selected
          </span>
          <select
            defaultValue=""
            aria-label="Set country for selected books"
            onChange={(e) => {
              if (!e.target.value) return;
              onAssignCountry(chosen, e.target.value);
              e.target.value = "";
            }}
          >
            <option value="">Set country to…</option>
            {ALL_COUNTRIES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.name}
              </option>
            ))}
          </select>
          <button
            className="ghost danger"
            onClick={() => {
              if (confirm(`Remove ${chosen.length} books from your library?`)) {
                onDeleteMany(chosen);
              }
            }}
          >
            Remove
          </button>
          <button className="ghost" onClick={onClearSelection}>
            Clear
          </button>
        </div>
      )}

      <ul className="book-list">
        {visible.map((book) => (
          <BookRow
            key={book.id}
            book={book}
            showCountry={showCountry}
            selected={selected.has(book.id)}
            onToggleSelect={onToggle}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
      {limit && books.length > limit && (
        <p className="muted small">
          Showing {limit} of {books.length}. "Select all" still covers every one.
        </p>
      )}
    </>
  );
}
