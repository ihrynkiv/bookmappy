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

console.log("--- errors ---");
console.log("react errors:", errors.length ? errors.slice(0, 3) : "none");

process.exit(errors.length ? 1 : 0);
