export type BookSearchResult = {
  key: string;
  title: string;
  author: string;
  year: number | null;
  pages: number | null;
  isbn: string | null;
  coverUrl: string | null;
};

type Doc = {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  number_of_pages_median?: number;
  cover_i?: number;
  isbn?: string[];
};

/** Title search for the manual "add a book" flow. */
export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookSearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    fields: "key,title,author_name,first_publish_year,cover_i,isbn,number_of_pages_median",
    limit: "8",
  });
  const res = await fetch(`https://openlibrary.org/search.json?${params}`, { signal });
  if (!res.ok) throw new Error(`Open Library search failed (${res.status})`);
  const docs: Doc[] = (await res.json()).docs ?? [];
  return docs
    .filter((d) => d.author_name?.length)
    .map((d) => ({
      key: d.key,
      title: d.title,
      author: d.author_name![0],
      year: d.first_publish_year ?? null,
      pages: d.number_of_pages_median ?? null,
      isbn: d.isbn?.[0] ?? null,
      coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-M.jpg` : null,
    }));
}
