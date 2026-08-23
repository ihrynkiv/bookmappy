import type { Book, CountryStat } from "../lib/types";
import { BookRow } from "./BookRow";

type Props = {
  stat: CountryStat;
  books: Book[];
  onClose: () => void;
  onEdit: (book: Book) => void;
  onDelete: (id: string) => void;
};

export function CountryPanel({ stat, books, onClose, onEdit, onDelete }: Props) {
  return (
    <section className="panel">
      <header className="panel-head">
        <div>
          <h2>{stat.name}</h2>
          <p className="muted">
            {stat.books} {stat.books === 1 ? "book" : "books"} · {stat.authors}{" "}
            {stat.authors === 1 ? "author" : "authors"}
            {stat.avgRating !== null && ` · ${stat.avgRating.toFixed(2)}★ average`}
            {stat.pages > 0 && ` · ${stat.pages.toLocaleString()} pages`}
          </p>
        </div>
        <button className="ghost" onClick={onClose} aria-label="Clear country filter">
          ✕
        </button>
      </header>
      <ul className="book-list">
        {books.map((book) => (
          <BookRow key={book.id} book={book} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </section>
  );
}
