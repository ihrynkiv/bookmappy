import type { Book } from "../lib/types";
import { countryName } from "../lib/geo";

type Props = {
  book: Book;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
  showCountry?: boolean;
};

export function BookRow({ book, onEdit, onDelete, showCountry }: Props) {
  return (
    <li className="book-row">
      {book.coverUrl ? (
        <img
          className="cover"
          src={book.coverUrl}
          alt=""
          loading="lazy"
          // Open Library serves a 1x1 placeholder for missing covers; hide those.
          onError={(e) => e.currentTarget.classList.add("cover-missing")}
        />
      ) : (
        <span className="cover cover-missing" />
      )}
      <div className="book-main">
        <span className="book-title">{book.title}</span>
        <span className="muted">
          {book.author}
          {showCountry && book.countryCode && ` · ${countryName(book.countryCode)}`}
          {book.shelf !== "read" && ` · ${book.shelf}`}
        </span>
        {book.note && <span className="note">{book.note}</span>}
      </div>
      <div className="book-side">
        <span className="rating">{book.rating ? "★".repeat(book.rating) : "—"}</span>
        {book.dateRead && <span className="muted small">{book.dateRead}</span>}
      </div>
      <div className="book-actions">
        <button className="ghost" onClick={() => onEdit(book)} title="Edit country">
          ✎
        </button>
        <button className="ghost danger" onClick={() => onDelete(book.id)} title="Remove book">
          🗑
        </button>
      </div>
    </li>
  );
}
