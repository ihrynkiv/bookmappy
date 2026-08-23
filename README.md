# 📚 bookmappy

Track what you read as a **map of the world**. Add books (or import your Goodreads
export), and every country you've read an author from fills in — darker the more
you've read. Click a country to see just those books.

- **Colour the map by** books read, distinct authors, average rating, or pages.
- **Author countries are looked up automatically** from Wikidata. No API key.
- **Import from Goodreads** via the CSV export.
- Works on phone and laptop. Static site, no server of your own.

## How an author gets a country

This is the part that actually needed thought, so it's worth knowing how it behaves.

Every lookup goes through the **Wikidata Query Service**, which can run Wikidata's
own fuzzy entity search *inside* a SPARQL query. That matters: the plain REST
search endpoint rate-limits after roughly five lookups with a 45-second
`Retry-After`, which makes importing a library impossible. One SPARQL query
resolves 20 authors at a time instead.

For each name, candidates are ranked by whether the person is a writer, then by
**how many Wikipedia language editions carry an article about them**. That
notability signal is what picks Homer the Greek poet over Winslow Homer, and
Bulgakov the novelist over the Soviet footballer of the same name.

Country then comes from, in order:

1. **Present-day citizenship** (`P27`) that carries an ISO code.
2. **Birthplace** (`P19` → country), when citizenship is a state that fragmented —
   the Soviet Union, Austria-Hungary, the Ottoman Empire. This is why Bulgakov, a
   Soviet citizen born in Kyiv, lands in **Ukraine** rather than Russia, and Kafka,
   a Czechoslovak citizen born in Prague, lands in the **Czech Republic**.
3. **Successor state**, for defunct states that map cleanly onto one modern country
   (Weimar Germany → Germany), and for antiquity (`scripts`-verified entries in
   [`src/data/historical.ts`](src/data/historical.ts) put Sun Tzu in China and
   Homer in Greece).

On a 30-author benchmark spanning modern, Soviet, Habsburg and ancient writers,
all 30 resolve correctly. It will still get things wrong — Nabokov comes out as
the United States, which is defensible but arguable. **Every book has a manual
country override**, and anything unresolved is listed under "Not on the map" with
a one-click fix. Manual choices are never overwritten by a later lookup.

## Running it locally

```bash
npm install
npm run dev
```

It works immediately with **no Firebase set up** — books are saved in that
browser only. See [SETUP.md](SETUP.md) to add sign-in and cross-device sync.

```bash
npm run check   # types, lint, and a jsdom render of the whole app
```

## How it's put together

| Path | What it does |
| --- | --- |
| `src/lib/wikidata.ts` | Batched SPARQL author → country resolution |
| `src/data/historical.ts` | Defunct states → modern countries (hand-curated) |
| `src/data/countries.generated.ts` | ISO codes, generated from Wikidata |
| `src/lib/goodreads.ts` | CSV export parser |
| `src/lib/geo.ts` | TopoJSON ↔ ISO alpha-2 bridge |
| `src/lib/stats.ts` | Per-country aggregation |
| `src/lib/store.ts` | Firestore-or-local storage, live-synced |
| `src/components/WorldMap.tsx` | The choropleth |

No API keys are needed for Wikidata or Open Library, and neither is proxied —
both send `Access-Control-Allow-Origin: *`, so the browser talks to them directly.

## Deploying

Pushing to `main` builds and publishes to GitHub Pages via
[`.github/workflows/deploy.yml`](.github/workflows/deploy.yml). See
[SETUP.md](SETUP.md) for the one-time Pages and Firebase configuration.

## Credits

Country data and author biography from [Wikidata](https://www.wikidata.org)
(CC0). Book search and covers from [Open Library](https://openlibrary.org).
Country shapes from [world-atlas](https://github.com/topojson/world-atlas)
(Natural Earth, public domain).
