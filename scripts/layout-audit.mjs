// Measures the real rendered layout in Chrome at phone and laptop widths.
// jsdom cannot do this — it has no layout engine — so CSS regressions like
// horizontal overflow are invisible to the smoke test.
//
//   npm run audit
import { createServer } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

// Drives a browser already on the machine rather than pulling a ~150MB one in.
const CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
];
const CHROME = process.env.CHROME_PATH ?? CANDIDATES.find((p) => existsSync(p));
if (!CHROME) {
  console.error("No Chrome found. Set CHROME_PATH to a Chromium-based browser.");
  process.exit(1);
}
const ROOT = fileURLToPath(new URL("../dist-audit", import.meta.url));
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" };

const server = createServer((req, res) => {
  const path = join(ROOT, decodeURIComponent(req.url.split("?")[0]));
  const file = existsSync(path) && extname(path) ? path : join(ROOT, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[extname(file)] ?? "text/plain" });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(0, r));
const url = `http://localhost:${server.address().port}/`;

const books = [
  ["1Q84", "Haruki Murakami", "JP", 5], ["The Trial", "Franz Kafka", "CZ", 4],
  ["Things Fall Apart", "Chinua Achebe", "NG", 5], ["Sapiens: A Brief History of Humankind", "Yuval Noah Harari", "IL", 4],
  ["The Master and Margarita", "Mikhail Bulgakov", "UA", 5], ["Norwegian Wood", "Haruki Murakami", "JP", 4],
  ["Crime and Punishment", "Fyodor Dostoevsky", "RU", 5], ["One Hundred Years of Solitude", "Gabriel Garcia Marquez", "CO", 5],
  ["The Remains of the Day", "Kazuo Ishiguro", "GB", 4], ["Beloved", "Toni Morrison", "US", 5],
  ["An Extremely Long Book Title That Should Never Widen The Page", "Some Author With A Very Long Name Indeed", null, 3],
  ["The Art of War", "Sun Tzu", null, 4],
];
// Cover shapes to exercise: a real cover, a legacy URL with no default=false
// whose ISBN has no art (Open Library answers 200 + a 1x1 GIF), the same ISBN
// already flagged (404s), and no URL at all.
// Put these on the two unplaced books, which are always on screen.
const COVERS = {
  // Legacy URL with no default=false, for an ISBN with no art: Open Library
  // answers 200 + a 1x1 GIF, so onError never fires. Must still fall back.
  "An Extremely Long Book Title That Should Never Widen The Page":
    "https://covers.openlibrary.org/b/isbn/9781974710805-M.jpg",
  // A real cover, which must survive and not be mistaken for a placeholder.
  "The Art of War": "https://covers.openlibrary.org/b/isbn/9780307476463-M.jpg?default=false",
};
const seed = JSON.stringify(books.map(([title, author, cc, rating], i) => ({
  id: `b${i}`, title, author, rating, dateRead: "2024-01-0" + ((i % 9) + 1), pages: 300, isbn: null,
  coverUrl: COVERS[title] ?? null, shelf: "read", authorQid: null, countryCode: cc, countryManual: false,
  status: cc ? "resolved" : "no-country", note: null, createdAt: 0, updatedAt: 0,
})));

const browser = await puppeteer.launch({ executablePath: CHROME, headless: "new", args: ["--no-sandbox"] });

async function audit(name, width, height, actions = async () => {}) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor: 2 });
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.evaluate((s) => localStorage.setItem("bookmappy.books.v1", s), seed);
  await page.reload({ waitUntil: "networkidle0" });
  await actions(page);
  // Covers are lazy-loaded; scroll to the bottom and let the network settle so
  // the fallback logic has actually run by the time we measure.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  // Wait for every cover img to settle (loaded or errored), not a fixed guess.
  await page.waitForFunction(
    () => [...document.querySelectorAll("img.cover")].every((i) => i.complete),
    { timeout: 15000 },
  ).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));

  const report = await page.evaluate(() => {
    const de = document.documentElement;
    const overflowing = [...document.querySelectorAll("*")]
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > de.clientWidth + 1 || r.left < -1);
      })
      .slice(0, 8)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return `${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)} w=${Math.round(r.width)}`;
      });
    const box = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { t: Math.round(r.top), l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width) };
    };
    const covers = {
      imgs: [...document.querySelectorAll("img.cover")].map((i) => ({
        w: i.naturalWidth, src: i.getAttribute("src") || "",
      })),
      fallbacks: document.querySelectorAll(".cover-fallback").length,
      unflagged: [...document.querySelectorAll("img.cover")]
        .filter((i) => (i.getAttribute("src") || "").includes("openlibrary") &&
                       !(i.getAttribute("src") || "").includes("default=false")).length,
    };
    return {
      covers,
      pageScrollW: de.scrollWidth, viewportW: de.clientWidth,
      hOverflow: de.scrollWidth > de.clientWidth + 1,
      overflowing,
      h1: box("h1"), signout: box(".topbar-actions"), totals: box(".totals"),
      map: box(".map-wrap"), panel: box(".panel"),
    };
  });

  console.log(`\n=== ${name} (${width}x${height}) ===`);
  console.log(`  page scrollWidth ${report.pageScrollW} vs viewport ${report.viewportW}  ->  ${report.hOverflow ? "❌ HORIZONTAL SCROLL" : "✓ no h-scroll"}`);
  if (report.overflowing.length) console.log("  overflowing:", report.overflowing.join("\n                ") );
  const fmt = (n, b) => (b ? `${n}: top=${b.t} left=${b.l} right=${b.r} w=${b.w}` : `${n}: absent`);
  console.log("  " + fmt("h1     ", report.h1));
  console.log("  " + fmt("signout", report.signout));
  console.log("  " + fmt("totals ", report.totals));
  console.log("  " + fmt("map    ", report.map));
  console.log("  " + fmt("panel  ", report.panel));
  const c = report.covers;
  console.log(`  covers: ${c.imgs.length} img, ${c.fallbacks} drawn fallback, ${c.unflagged} unflagged url` +
              (c.imgs.length ? ` | natural widths: ${c.imgs.map((i) => i.w).join(",")}` : ""));
  const blank = c.imgs.filter((i) => i.w > 0 && i.w <= 2).length;
  if (blank || c.unflagged) console.log(`  ❌ ${blank} blank 1x1 image(s) shown, ${c.unflagged} unflagged url(s)`);
  report.coverProblem = blank > 0 || c.unflagged > 0;
  await page.screenshot({ path: `dist-audit/shot-${name}.png`, fullPage: true });
  await page.close();
  return report;
}

const results = [];
results.push(await audit("mobile", 390, 844));
results.push(await audit("mobile-selected", 390, 844, async (p) => {
  await p.evaluate(() => [...document.querySelectorAll(".rank-row")][0]?.click());
  await new Promise((r) => setTimeout(r, 250));
}));
// The audit build runs local-only, so no sign-out button exists. Inject one to
// check the signed-in header: title left, sign-out right, stats on line two.
const signedIn = async (p) => {
  await p.evaluate(() => {
    const slot = document.querySelector(".topbar-actions");
    const b = document.createElement("button");
    b.className = "ghost";
    b.textContent = "Sign out";
    slot.appendChild(b);
  });
};
results.push(await audit("mobile-signed-in", 390, 844, signedIn));
results.push(await audit("mobile-small", 320, 700));
results.push(await audit("mobile-small-signed-in", 320, 700, signedIn));
results.push(await audit("laptop", 1280, 800));

await browser.close();
server.close();

const bad = results.filter((r) => r.hOverflow).length;
const coverBad = results.filter((r) => r.coverProblem).length;
console.log(`\n${bad === 0 ? "✓ no horizontal overflow at any width" : `❌ ${bad} viewport(s) overflow`}`);
console.log(`${coverBad === 0 ? "✓ no blank placeholder images shown" : `❌ blank covers at ${coverBad} viewport(s)`}`);
process.exit(bad === 0 && coverBad === 0 ? 0 : 1);
