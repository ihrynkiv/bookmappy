// End-to-end: parse a Goodreads export, resolve every author, aggregate stats.
const orig = globalThis.fetch;
globalThis.fetch = ((u: any, o: any = {}) =>
  orig(u, { ...o, headers: { ...(o.headers || {}), "User-Agent": "bookmappy/0.1 (https://github.com/ihrynkiv/bookmappy)" } })) as any;

const { parseGoodreadsCsv } = await import("../src/lib/goodreads");
const { resolveAuthors } = await import("../src/lib/wikidata");
const { computeCountryStats, computeTotals } = await import("../src/lib/stats");
const { readFileSync } = await import("node:fs");

const { books } = parseGoodreadsCsv(readFileSync(new URL("sample-goodreads.csv", import.meta.url), "utf8"));
const res = await resolveAuthors(books.map(b => b.author));
const placed = books.map(b => { const r = res.get(b.author)!; return { ...b, countryCode: r.countryCode, status: r.status, note: r.note }; });
const read = placed.filter(b => b.shelf === "read");
const stats = computeCountryStats(read);
console.log("totals:", JSON.stringify(computeTotals(read, stats)));
console.log("map:", [...stats.values()].map(s => `${s.name}=${s.books}${s.avgRating ? "@" + s.avgRating.toFixed(1) + "★" : ""}`).join(", "));
console.log("to-read shelf:", placed.filter(b => b.shelf !== "read").map(b => `${b.title} -> ${b.countryCode}`).join(", "));
process.exit(0);
