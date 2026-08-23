// Renders the whole app against a seeded library in jsdom and drives the parts
// that matter. Catches the class of bug the type-checker cannot: bad hooks,
// duplicate keys, crashes on first paint, and broken interaction wiring.
import { JSDOM } from "jsdom";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "https://example.com/" });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document;
Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Node = dom.window.Node; g.Element = dom.window.Element;
g.localStorage = dom.window.localStorage; g.SVGElement = dom.window.SVGElement;
g.IS_REACT_ACT_ENVIRONMENT = true;
g.confirm = () => true;

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const React = (await import("react")).default;
const App = (await import("../src/App")).default;
const { parseGoodreadsCsv } = await import("../src/lib/goodreads");
const { computeCountryStats, computeTotals } = await import("../src/lib/stats");
const { COUNTRY_FEATURES } = await import("../src/lib/geo");
const { readFileSync } = await import("node:fs");

const KEY = "bookmappy.books.v1";
const parsed = parseGoodreadsCsv(readFileSync(new URL("sample-goodreads.csv", import.meta.url), "utf8"));
// Two authors deliberately left unplaced, to exercise the repair flow.
const codes: Record<string, string> = {
  "Haruki Murakami": "JP", "Franz Kafka": "CZ", "Chinua Achebe": "NG", "Taras Shevchenko": "UA",
};
const seeded = parsed.books.map((b) => ({
  ...b,
  countryCode: codes[b.author] ?? null,
  status: (codes[b.author] ? "resolved" : "no-country") as any,
  // Three cover shapes: none at all, a legacy URL without default=false (the
  // shape imported before that flag existed), and a normal flagged one.
  coverUrl:
    b.author === "Mikhail Bulgakov" ? null
    : b.author === "Yuval Noah Harari" ? "https://covers.openlibrary.org/b/isbn/9781974710805-M.jpg"
    : b.coverUrl,
}));
dom.window.localStorage.setItem(KEY, JSON.stringify(seeded));

const errors: string[] = [];
const origErr = console.error;
console.error = (...a: any[]) => { errors.push(a.map(String).join(" ")); origErr(...a); };

const root = createRoot(document.getElementById("root")!);
await act(async () => { root.render(React.createElement(App)); });

const q = (sel: string) => document.querySelector(sel);
const qa = (sel: string) => [...document.querySelectorAll(sel)];
const fire = (el: Element, type: string) =>
  el.dispatchEvent(new dom.window.Event(type, { bubbles: true }));
/**
 * React installs its own value tracker on form elements, so a plain
 * `el.value = x` is treated as a no-op change. Going through the prototype's
 * native setter bypasses the tracker, which is what the testing-library
 * helpers do internally.
 */
const setNativeValue = (el: any, proto: any, value: string) => {
  Object.getOwnPropertyDescriptor(proto.prototype, "value")!.set!.call(el, value);
  fire(el, "change");
};

console.log("--- render ---");
console.log("atlas features:", COUNTRY_FEATURES.length, "| paths:", qa("path.country").length,
            "| painted:", qa("path.country.has-books").length);
const read = seeded.filter((b) => b.shelf === "read");
console.log("stats:", JSON.stringify(computeTotals(read, computeCountryStats(read))));

console.log("--- covers ---");
console.log("img covers:", qa("img.cover").length, "| drawn fallbacks:", qa(".cover-fallback").length,
            "| initials:", qa(".cover-initial").map((e) => e.textContent).join(""));
console.log("no legacy empty boxes:", qa(".cover-missing").length === 0);

console.log("--- cover url normalisation ---");
const { withDefaultFalse } = await import("../src/lib/covers");
const cases: [string | null, string][] = [
  ["https://covers.openlibrary.org/b/isbn/123-M.jpg", "https://covers.openlibrary.org/b/isbn/123-M.jpg?default=false"],
  ["https://covers.openlibrary.org/b/isbn/123-M.jpg?default=false", "https://covers.openlibrary.org/b/isbn/123-M.jpg?default=false"],
  ["https://covers.openlibrary.org/b/id/9-M.jpg?foo=1", "https://covers.openlibrary.org/b/id/9-M.jpg?foo=1&default=false"],
  ["https://example.com/cover.jpg", "https://example.com/cover.jpg"],
  [null, null as any],
];
for (const [input, want] of cases) {
  const got = withDefaultFalse(input);
  console.log(`  ${got === want ? "ok  " : "FAIL"} ${String(input).slice(0, 58)} -> ${String(got).slice(-24)}`);
  if (got !== want) errors.push(`withDefaultFalse(${input}) = ${got}, want ${want}`);
}
const legacyImg = qa("img.cover").find((e) => (e as any).src.includes("9781974710805")) as any;
console.log("  legacy seeded URL rendered with flag:", Boolean(legacyImg?.src.includes("default=false")));
if (legacyImg && !legacyImg.src.includes("default=false")) errors.push("legacy cover URL not normalised");

console.log("--- re-import merge ---");
{
  const { planImport } = await import("../src/lib/import");
  const base: any = {
    id: "gr-1", title: "Kobzar", author: "Taras Shevchenko", rating: 4, dateRead: "2023-01-01",
    pages: 100, isbn: null, coverUrl: null, shelf: "to-read", authorQid: "Q134958",
    countryCode: "UA", countryManual: false, status: "resolved", note: "birthplace",
    createdAt: 1, updatedAt: 1,
  };
  const check = (name: string, cond: boolean, detail = "") => {
    console.log(`  ${cond ? "ok  " : "FAIL"} ${name}${detail ? "  " + detail : ""}`);
    if (!cond) errors.push("planImport: " + name);
  };

  const brandNew = { ...base, id: "gr-2", title: "New Book", countryCode: null, status: "pending" };
  let p = planImport([base], [base, brandNew], true);
  check("new book added, identical one left alone", p.added === 1 && p.unchanged === 1 && p.books.length === 1);

  // Re-export marks it read with a new rating: refresh, but keep the country.
  const reread = { ...base, rating: 5, shelf: "read", dateRead: "2024-06-01",
                   countryCode: null, status: "pending", authorQid: null, note: null };
  p = planImport([base], [reread], true);
  const merged = p.books[0];
  check("rating/shelf/date refreshed", merged.rating === 5 && merged.shelf === "read" && merged.dateRead === "2024-06-01");
  check("resolution preserved, not reset", merged.countryCode === "UA" && merged.status === "resolved" && merged.authorQid === "Q134958",
        `got ${merged.countryCode}/${merged.status}`);

  // The whole point: a manual override must survive a re-import.
  const manual = { ...base, countryManual: true, countryCode: "PL", note: "set by hand" };
  p = planImport([manual], [reread], true);
  check("manual country survives re-import", p.books[0].countryCode === "PL" && p.books[0].countryManual === true);

  // Author renamed and country was automatic -> stale, so look it up again.
  p = planImport([base], [{ ...base, author: "T. Shevchenko" }], true);
  check("renamed author re-resolves", p.books[0].status === "pending" && p.books[0].countryCode === null);
  // ...but not when a human chose the country.
  p = planImport([manual], [{ ...base, author: "T. Shevchenko" }], true);
  check("renamed author does NOT undo a manual country", p.books[0].countryCode === "PL");

  p = planImport([base], [reread, brandNew], false);
  check("updateExisting=false skips known books", p.added === 1 && p.skipped === 1 && p.books.length === 1);

  const big = Array.from({ length: 300 }, (_, i) => ({ ...base, id: `gr-${i}` }));
  p = planImport(big, big, true);
  check("re-importing an unchanged library writes nothing", p.books.length === 0 && p.unchanged === 300);
}

console.log("--- sorting ---");
{
  const { sortBooks } = await import("../src/lib/sort");
  const mk = (title: string, rating: any, cc: any, date: any) =>
    ({ title, author: "A", rating, countryCode: cc, dateRead: date }) as any;
  const list = [mk("b", 3, "JP", "2024-01-01"), mk("a", null, null, null), mk("c", 5, "AR", "2023-01-01")];
  const t = (f: any, d: any) => sortBooks(list, f, d).map((b) => b.title).join("");
  const check = (name: string, got: string, want: string) => {
    console.log(`  ${got === want ? "ok  " : "FAIL"} ${name}: ${got}${got === want ? "" : " want " + want}`);
    if (got !== want) errors.push(`sort ${name}`);
  };
  check("rating desc, nulls last", t("rating", "desc"), "cba");
  check("rating asc, nulls last", t("rating", "asc"), "bca");
  check("country asc (by name)", t("country", "asc"), "cba");
  check("date desc, nulls last", t("dateRead", "desc"), "bca");
  check("title asc", t("title", "asc"), "abc");
}

console.log("--- bulk edit ---");
const unplacedRows = qa(".panel input.row-check").length;
console.log("unplaced rows with checkboxes:", unplacedRows);
console.log("bulk bar hidden before selecting:", q(".bulk-bar") === null);

// Select all unplaced books.
const selectAll = q(".list-tools input[type=checkbox]") as any;
await act(async () => { selectAll.click(); });
console.log("bulk bar shown after select all:", q(".bulk-bar") !== null,
            "| label:", q(".bulk-bar strong")?.textContent,
            "| rows highlighted:", qa(".book-row.row-selected").length);

// Assign a country to the whole selection.
const picker = q(".bulk-bar select") as any;
await act(async () => { setNativeValue(picker, dom.window.HTMLSelectElement, "PL"); });

const saved = JSON.parse(dom.window.localStorage.getItem(KEY)!);
const nowPolish = saved.filter((b: any) => b.countryCode === "PL");
console.log("assigned to Poland:", nowPolish.length,
            "| all marked manual:", nowPolish.every((b: any) => b.countryManual === true),
            "| status:", [...new Set(nowPolish.map((b: any) => b.status))].join(","));
console.log("selection cleared after assign:", q(".bulk-bar") === null);
console.log("Poland now on the map:", qa("path.country.has-books").length);

console.log("--- navigation ---");
{
  const totals = qa(".total") as any[];
  console.log("  clickable stat buttons:", totals.length);
  await act(async () => { totals[0].click(); });
  const inBooks = document.body.textContent?.includes("All books");
  console.log("  clicking a stat opens the books view:", inBooks,
              "| sort buttons:", qa(".sort-btn").length,
              "| rows:", qa(".book-row").length);
  if (!inBooks) errors.push("stat click did not open the books view");

  const firstBefore = q(".book-row .book-title")?.textContent;
  const titleSort = qa(".sort-btn").find((b) => b.textContent?.startsWith("Title")) as any;
  await act(async () => { titleSort.click(); });
  const firstAfter = q(".book-row .book-title")?.textContent;
  console.log(`  sorting by title reorders: ${firstBefore !== firstAfter} (${firstBefore} -> ${firstAfter})`);
  if (firstBefore === firstAfter) errors.push("sort by title did not reorder");

  await act(async () => { (q(".wordmark") as any).click(); });
  const home = q(".map-wrap") !== null && !document.body.textContent?.includes("All books");
  console.log("  clicking the wordmark returns to the map:", home);
  if (!home) errors.push("wordmark did not return home");
}

console.log("--- errors ---");
console.log("react errors:", errors.length ? errors.slice(0, 3) : "none");

process.exit(errors.length ? 1 : 0);
