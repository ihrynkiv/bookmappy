import type { ComponentProps } from "react";
import type { Book, CountryStat } from "../lib/types";
import { BookList } from "./BookList";

type Props = {
  stat: CountryStat;
  books: Book[];
  onClose: () => void;
  /** Everything the shared list needs for selection and bulk actions. */
  selection: Omit<ComponentProps<typeof BookList>, "books" | "showCountry" | "limit">;
};

export function CountryPanel({ stat, books, onClose, selection }: Props) {
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
      <BookList books={books} {...selection} />
    </section>
  );
}
