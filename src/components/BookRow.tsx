import type { Book } from "../lib/types";
import { countryName } from "../lib/geo";
import { languageName } from "../lib/languages";
import { Cover } from "./Cover";

type Props = {
  book: Book;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  showCountry?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
};

export function BookRow({
  book, onEdit, onDelete, showCountry, selected, onToggleSelect,
}: Props) {
  return (
    <li className={`book-row${selected ? " row-selected" : ""}`}>
      {onToggleSelect && (
        <input
          type="checkbox"
          className="row-check"
          checked={Boolean(selected)}
          onChange={() => onToggleSelect(book.id)}
          aria-label={`Select ${book.title}`}
        />
      )}
      <Cover title={book.title} author={book.author} url={book.coverUrl} />
      <div className="book-main">
        <span className="book-title">{book.title}</span>
        {/* The author is the part that truncates: the country is short, and it
            is the whole point of this app, so it keeps its space. */}
        <span className="book-meta muted">
          <span className="book-author">{book.author}</span>
          {showCountry && book.countryCode && (
            <span className="book-country">{countryName(book.countryCode)}</span>
          )}
          {book.language && <span className="book-lang">{languageName(book.language)}</span>}
          {book.shelf !== "read" && <span className="book-shelf">{book.shelf}</span>}
        </span>
        {book.note && <span className="note">{book.note}</span>}
      </div>
      <div className="book-side">
        <span className="rating">{book.rating ? "★".repeat(book.rating) : "—"}</span>
        {book.dateRead && <span className="muted small">{book.dateRead}</span>}
      </div>
      <div className="book-actions">
        <button className="ghost" onClick={() => onEdit(book)} title="Edit book">
          ✎
        </button>
        <button className="ghost danger" onClick={() => onDelete(book.id)} title="Remove book">
          🗑
        </button>
      </div>
    </li>
  );
}
