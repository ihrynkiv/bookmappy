// Renders the whole app against a seeded library in jsdom. Catches the class of
// bug the type-checker cannot: bad hooks, duplicate keys, crashes on first paint.
import { JSDOM } from "jsdom";
const dom = new JSDOM(`<!doctype html><html><body><div id="root"></div></body></html>`, { url: "https://example.com/" });
const g = globalThis as any;
g.window = dom.window; g.document = dom.window.document; Object.defineProperty(g, "navigator", { value: dom.window.navigator, configurable: true });
g.HTMLElement = dom.window.HTMLElement; g.Node = dom.window.Node; g.Element = dom.window.Element;
g.localStorage = dom.window.localStorage; g.SVGElement = dom.window.SVGElement;

g.IS_REACT_ACT_ENVIRONMENT = true;

const { createRoot } = await import("react-dom/client");
const { act } = await import("react");
const React = (await import("react")).default;
const App = (await import("../src/App")).default;
const { parseGoodreadsCsv } = await import("../src/lib/goodreads");
const { computeCountryStats, computeTotals } = await import("../src/lib/stats");
const { COUNTRY_FEATURES } = await import("../src/lib/geo");
const { readFileSync } = await import("node:fs");

// Seed localStorage with a resolved library so the map path renders, not just the empty state.
const parsed = parseGoodreadsCsv(readFileSync(new URL("sample-goodreads.csv", import.meta.url),"utf8"));
const codes:Record<string,string> = {"Haruki Murakami":"JP","Franz Kafka":"CZ","Chinua Achebe":"NG","Yuval Noah Harari":"IL","Mikhail Bulgakov":"UA","Taras Shevchenko":"UA"};
const seeded = parsed.books.map(b=>({...b, countryCode: codes[b.author]??null, status: (codes[b.author]?"resolved":"no-country") as any}));
dom.window.localStorage.setItem("bookmappy.books.v1", JSON.stringify(seeded));

const errors: string[] = [];
const origErr = console.error;
console.error = (...a:any[]) => { errors.push(a.map(String).join(" ")); origErr(...a); };

const root = createRoot(document.getElementById("root")!);
await act(async () => { root.render(React.createElement(App)); });

const html = document.getElementById("root")!.innerHTML;
const paths = document.querySelectorAll("path.country").length;
const painted = document.querySelectorAll("path.country.has-books").length;

console.log("--- render ---");
console.log("atlas features:", COUNTRY_FEATURES.length, "| rendered paths:", paths, "| painted:", painted);
const stats = computeCountryStats(seeded.filter(b=>b.shelf==="read"));
const totals = computeTotals(seeded.filter(b=>b.shelf==="read"), stats);
console.log("stats:", JSON.stringify(totals));
console.log("countries:", [...stats.values()].map(s=>`${s.name}:${s.books}${s.avgRating?"@"+s.avgRating.toFixed(1):""}`).join(", "));
console.log("has map:", html.includes("map-wrap"), "| has totals:", html.includes("countries"), "| legend swatches:", document.querySelectorAll(".swatch").length);
console.log("react errors:", errors.length ? errors.slice(0,3) : "none");

process.exit(errors.length ? 1 : 0);
