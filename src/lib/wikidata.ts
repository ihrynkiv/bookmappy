import { COUNTRIES } from "../data/countries.generated";
import { HISTORICAL_STATES } from "../data/historical";
import type { AuthorCandidate, Resolution } from "./types";

const ENDPOINT = "https://query.wikidata.org/sparql";

/**
 * Everything runs through the Wikidata Query Service rather than the REST
 * `wbsearchentities` endpoint. WDQS can call the same fuzzy entity search
 * internally (`wikibase:mwapi`), which means one HTTP request resolves a whole
 * batch of author names. The REST endpoint rate-limits at roughly five lookups
 * before returning 429 with a 45-second Retry-After, which makes importing a
 * Goodreads library impossible.
 */
const AUTHORS_PER_QUERY = 20;
const MAX_RETRIES = 4;
/** Small gap between batches so a big import stays under the throttle. */
const BATCH_GAP_MS = 400;

/** Occupations that make a person a plausible book author, for ranking matches. */
const WRITING_OCCUPATIONS = new Set([
  "Q36180", "Q49757", "Q6625963", "Q214917", "Q4853732", "Q11774202",
  "Q18844224", "Q1930187", "Q182436", "Q12144794", "Q28389", "Q3499072",
  "Q1607826", "Q4964182", "Q201788", "Q193391", "Q15980158", "Q482980",
  "Q6051619", "Q13570226", "Q8178443",
]);

type Row = {
  name: { value: string };
  author: { value: string };
  authorLabel?: { value: string };
  authorDescription?: { value: string };
  sitelinks?: { value: string };
  occs?: { value: string };
  cits?: { value: string };
  isos?: { value: string };
  birthIso?: { value: string };
};

function buildQuery(names: string[]): string {
  const values = names.map((n) => JSON.stringify(n)).join(" ");
  return `PREFIX mwapi: <https://www.mediawiki.org/ontology#API/>
SELECT ?name ?author ?authorLabel ?authorDescription ?sitelinks
       (GROUP_CONCAT(DISTINCT ?occq; separator=",") AS ?occs)
       (GROUP_CONCAT(DISTINCT ?citq; separator=",") AS ?cits)
       (GROUP_CONCAT(DISTINCT ?iso;  separator=",") AS ?isos)
       (SAMPLE(?bIso) AS ?birthIso)
WHERE {
  VALUES ?name { ${values} }
  SERVICE wikibase:mwapi {
    bd:serviceParam wikibase:endpoint "www.wikidata.org";
                    wikibase:api "EntitySearch";
                    mwapi:search ?name;
                    mwapi:language "en";
                    mwapi:limit "6".
    ?author wikibase:apiOutputItem mwapi:item.
  }
  # p:/ps: rather than the truthy wdt: shortcut — wdt: exposes only best-rank
  # statements, and Homer's "instance of: human" is outranked by "instance of:
  # mythological Greek character", which would drop him from every result.
  ?author p:P31/ps:P31 wd:Q5 ; wikibase:sitelinks ?sitelinks .
  OPTIONAL { ?author wdt:P106 ?occ . BIND(STRAFTER(STR(?occ),"entity/") AS ?occq) }
  OPTIONAL { ?author wdt:P27 ?cit . BIND(STRAFTER(STR(?cit),"entity/") AS ?citq)
             OPTIONAL { ?cit wdt:P297 ?iso } }
  OPTIONAL { ?author wdt:P19/wdt:P17/wdt:P297 ?bIso . }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}
GROUP BY ?name ?author ?authorLabel ?authorDescription ?sitelinks`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * WDQS throttles bursts with 429/503 and an optional Retry-After. Importing a
 * large library sends several queries back to back, so honour the header and
 * back off rather than dropping authors on the floor.
 */
async function sparql(query: string, attempt = 0): Promise<Row[]> {
  const res = await fetch(`${ENDPOINT}?query=${encodeURIComponent(query)}`, {
    headers: { Accept: "application/sparql-results+json" },
  });
  if (res.status === 429 || res.status === 503) {
    if (attempt >= MAX_RETRIES) throw new Error("Wikidata is rate-limiting; try again shortly");
    const retryAfter = Number(res.headers.get("retry-after"));
    const waitMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? Math.min(retryAfter, 60) * 1000
      : 2000 * 2 ** attempt;
    await sleep(waitMs);
    return sparql(query, attempt + 1);
  }
  if (!res.ok) throw new Error(`Wikidata query failed (${res.status})`);
  const json = await res.json();
  return json.results?.bindings ?? [];
}

const runQuery = (names: string[]) => sparql(buildQuery(names));

const split = (v?: { value: string }) => (v?.value ? v.value.split(",").filter(Boolean) : []);

type Match = {
  qid: string;
  label: string;
  description: string;
  occupations: string[];
  citizenships: string[];
  isos: string[];
  birthIso: string | null;
  /** Number of Wikipedia editions with an article. A robust notability proxy. */
  sitelinks: number;
};

function toMatch(row: Row): Match {
  return {
    qid: row.author.value.split("/").pop() ?? "",
    label: row.authorLabel?.value ?? "",
    description: row.authorDescription?.value ?? "",
    occupations: split(row.occs),
    citizenships: split(row.cits),
    isos: split(row.isos).map((c) => c.toUpperCase()),
    birthIso: row.birthIso?.value?.toUpperCase() ?? null,
    sitelinks: Number(row.sitelinks?.value ?? 0),
  };
}

const isWriter = (m: Match) => m.occupations.some((o) => WRITING_OCCUPATIONS.has(o));

/**
 * Pick a country for one Wikidata person.
 *
 * Present-day citizenship wins outright. When citizenship is a state that no
 * longer exists, we consult `HISTORICAL_STATES`: for states that fragmented
 * (the Soviet Union, Austria-Hungary) the author's birthplace is a much better
 * signal than the nominal successor, so Bulgakov — a Soviet citizen born in
 * Kyiv — is attributed to Ukraine rather than Russia.
 */
function countryFor(m: Match): { code: string | null; note: string | null } {
  const modern = m.isos.find((c) => COUNTRIES[c]);
  if (modern) return { code: modern, note: null };

  let successor: { code: string; note: string } | null = null;
  for (const qid of m.citizenships) {
    const historical = HISTORICAL_STATES[qid];
    if (!historical) continue;
    if (historical.preferBirthplace && m.birthIso && COUNTRIES[m.birthIso]) {
      return { code: m.birthIso, note: "birthplace (citizenship was a former state)" };
    }
    successor ??= { code: historical.successor, note: "successor of a former state" };
  }

  if (m.birthIso && COUNTRIES[m.birthIso]) {
    return { code: m.birthIso, note: "birthplace (no citizenship recorded)" };
  }
  return successor ? { ...successor } : { code: null, note: null };
}

/**
 * Rank matches for a searched name. Being a writer dominates; after that,
 * notability decides — measured as the number of Wikipedia language editions
 * carrying an article. That is what separates Homer the Greek poet (271
 * editions) from an obscure modern namesake, and Bulgakov the novelist from the
 * Soviet footballer. Placeability is only a mild tiebreak, so a famous ancient
 * author still beats a nobody who happens to have a country on file.
 */
function rank(a: Match, b: Match): number {
  const score = (m: Match) =>
    (isWriter(m) ? 1000 : 0) + Math.min(m.sitelinks, 300) + (countryFor(m).code ? 10 : 0);
  return score(b) - score(a);
}

function resolveFromMatches(matches: Match[]): Resolution {
  if (matches.length === 0) {
    return { qid: null, countryCode: null, status: "not-found", note: null, candidates: [] };
  }
  const sorted = [...matches].sort(rank);
  const candidates: AuthorCandidate[] = sorted.map((m) => ({
    qid: m.qid,
    label: m.label,
    description: m.description,
    isWriter: isWriter(m),
  }));

  const best = sorted[0];
  const { code, note } = countryFor(best);

  // Two writers of the same name pointing at different countries is a real
  // coin-flip; surface it instead of silently colouring the wrong country.
  const rivals = sorted.filter((m) => isWriter(m) && countryFor(m).code);
  const contested =
    rivals.length > 1 && new Set(rivals.map((m) => countryFor(m).code)).size > 1;

  if (!code) {
    return { qid: best.qid, countryCode: null, status: "no-country", note: null, candidates };
  }
  return {
    qid: best.qid,
    countryCode: code,
    status: contested ? "ambiguous" : "resolved",
    note: contested ? `matched "${best.description}" — other writers share this name` : note,
    candidates,
  };
}

/** Resolve many author names, batching them into as few queries as possible. */
export async function resolveAuthors(
  names: string[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, Resolution>> {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  const results = new Map<string, Resolution>();

  for (let i = 0; i < unique.length; i += AUTHORS_PER_QUERY) {
    const batch = unique.slice(i, i + AUTHORS_PER_QUERY);
    const grouped = new Map<string, Match[]>(batch.map((n) => [n, []]));
    try {
      for (const row of await runQuery(batch)) {
        grouped.get(row.name.value)?.push(toMatch(row));
      }
      for (const [name, matches] of grouped) results.set(name, resolveFromMatches(matches));
    } catch {
      // A failed batch leaves those authors unresolved rather than failing the
      // whole import; the user can retry them from the Unplaced list.
      for (const name of batch) {
        results.set(name, {
          qid: null, countryCode: null, status: "pending",
          note: "lookup failed — retry", candidates: [],
        });
      }
    }
    onProgress?.(Math.min(i + AUTHORS_PER_QUERY, unique.length), unique.length);
    if (i + AUTHORS_PER_QUERY < unique.length) await sleep(BATCH_GAP_MS);
  }
  return results;
}

export async function resolveAuthor(name: string): Promise<Resolution> {
  const map = await resolveAuthors([name]);
  return (
    map.get(name.trim()) ?? {
      qid: null, countryCode: null, status: "not-found", note: null, candidates: [],
    }
  );
}

/** Re-resolve after the user picks a specific person from the candidate list. */
export async function countryForQid(
  qid: string,
): Promise<{ countryCode: string | null; note: string | null }> {
  const query = `SELECT ?author (GROUP_CONCAT(DISTINCT ?citq; separator=",") AS ?cits)
       (GROUP_CONCAT(DISTINCT ?iso; separator=",") AS ?isos) (SAMPLE(?bIso) AS ?birthIso)
WHERE {
  BIND(wd:${qid} AS ?author)
  OPTIONAL { ?author wdt:P27 ?cit . BIND(STRAFTER(STR(?cit),"entity/") AS ?citq)
             OPTIONAL { ?cit wdt:P297 ?iso } }
  OPTIONAL { ?author wdt:P19/wdt:P17/wdt:P297 ?bIso . }
} GROUP BY ?author`;
  const rows = await sparql(query);
  if (rows.length === 0) return { countryCode: null, note: null };
  const { code, note } = countryFor({
    qid, label: "", description: "", occupations: [], sitelinks: 0,
    citizenships: split(rows[0].cits),
    isos: split(rows[0].isos).map((c) => c.toUpperCase()),
    birthIso: rows[0].birthIso?.value?.toUpperCase() ?? null,
  });
  return { countryCode: code, note };
}
