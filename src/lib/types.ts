export type ResolutionStatus =
  | "pending" // never attempted
  | "resolved" // we have a country
  | "ambiguous" // several plausible authors; needs a human pick
  | "not-found" // no Wikidata author matched the name
  | "no-country"; // author found, but Wikidata records no usable country

export type Book = {
  id: string;
  title: string;
  author: string;
  rating: number | null; // 1-5; null = unrated
  dateRead: string | null; // YYYY-MM-DD
  pages: number | null;
  isbn: string | null;
  coverUrl: string | null;
  shelf: string; // "read" | "to-read" | "currently-reading" | custom
  authorQid: string | null;
  countryCode: string | null; // ISO 3166-1 alpha-2
  countryManual: boolean; // user overrode the automatic answer
  status: ResolutionStatus;
  note: string | null; // how we arrived at the country, shown in the UI
  createdAt: number;
  updatedAt: number;
};

export type AuthorCandidate = {
  qid: string;
  label: string;
  description: string;
  isWriter: boolean;
};

export type Resolution = {
  qid: string | null;
  countryCode: string | null;
  status: ResolutionStatus;
  note: string | null;
  candidates: AuthorCandidate[];
};

/** Aggregated per-country figures backing both the choropleth and the side panel. */
export type CountryStat = {
  code: string;
  name: string;
  books: number;
  authors: number;
  ratedBooks: number;
  avgRating: number | null;
  pages: number;
};

export type Metric = "books" | "authors" | "avgRating" | "pages";
