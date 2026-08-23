import { useState } from "react";
import { parseGoodreadsCsv } from "../lib/goodreads";
import { planImport } from "../lib/import";
import type { Book } from "../lib/types";
import { Dialog } from "./Dialog";

type Props = {
  existing: Book[];
  onImport: (books: Book[], updateExisting: boolean) => Promise<void>;
  onClose: () => void;
};

type Stage =
  | { kind: "idle" }
  | { kind: "parsed"; books: Book[]; skipped: number; shelves: string[] }
  | { kind: "saving" }
  | { kind: "error"; message: string };

export function ImportDialog({ existing, onImport, onClose }: Props) {
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [shelves, setShelves] = useState<Set<string>>(new Set(["read"]));
  /** Refresh ratings and dates on books already in the library. */
  const [updateExisting, setUpdateExisting] = useState(true);

  async function handleFile(file: File) {
    try {
      const parsed = parseGoodreadsCsv(await file.text());
      if (parsed.books.length === 0) {
        setStage({
          kind: "error",
          message: "No books found. Is this the CSV from goodreads.com/review/import?",
        });
        return;
      }
      setShelves(new Set(parsed.detectedShelves.filter((s) => s === "read")));
      setStage({
        kind: "parsed",
        books: parsed.books,
        skipped: parsed.skipped,
        shelves: parsed.detectedShelves,
      });
    } catch (e) {
      setStage({ kind: "error", message: (e as Error).message });
    }
  }

  const selected =
    stage.kind === "parsed" ? stage.books.filter((b) => shelves.has(b.shelf)) : [];
  const plan = planImport(existing, selected, updateExisting);

  return (
    <Dialog title="Import from Goodreads" onClose={onClose} wide>
      {stage.kind === "idle" && (
        <>
          <ol className="steps">
            <li>
              Open{" "}
              <a href="https://www.goodreads.com/review/import" target="_blank" rel="noreferrer">
                goodreads.com/review/import
              </a>{" "}
              and press <strong>Export Library</strong>.
            </li>
            <li>Wait for the link to appear, then download the CSV.</li>
            <li>Drop it here.</li>
          </ol>
          <label className="dropzone">
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <span>Choose your goodreads_library_export.csv</span>
          </label>
        </>
      )}

      {stage.kind === "error" && (
        <>
          <p className="error">{stage.message}</p>
          <button className="ghost" onClick={() => setStage({ kind: "idle" })}>
            Try another file
          </button>
        </>
      )}

      {stage.kind === "parsed" && (
        <>
          <p>
            Found <strong>{stage.books.length}</strong> books
            {stage.skipped > 0 && ` (${stage.skipped} unusable rows skipped)`}. Which shelves
            should go on the map?
          </p>
          <div className="shelf-picker">
            {stage.shelves.map((shelf) => {
              const count = stage.books.filter((b) => b.shelf === shelf).length;
              return (
                <label key={shelf} className="check">
                  <input
                    type="checkbox"
                    checked={shelves.has(shelf)}
                    onChange={(e) => {
                      const next = new Set(shelves);
                      if (e.target.checked) next.add(shelf);
                      else next.delete(shelf);
                      setShelves(next);
                    }}
                  />
                  {shelf} <span className="muted small">({count})</span>
                </label>
              );
            })}
          </div>
          {existing.length > 0 && (
            <label className="check update-toggle">
              <input
                type="checkbox"
                checked={updateExisting}
                onChange={(e) => setUpdateExisting(e.target.checked)}
              />
              Refresh ratings, dates and shelves on books I already have
            </label>
          )}

          <p className="plan">
            <strong>{plan.added}</strong> new
            {plan.updated > 0 && <> · <strong>{plan.updated}</strong> updated</>}
            {plan.unchanged > 0 && <> · {plan.unchanged} already up to date</>}
            {plan.skipped > 0 && <> · {plan.skipped} skipped</>}
          </p>
          <p className="muted small">
            Books already in your library keep the country they resolved to, including any
            you set by hand — so nothing is looked up twice. Only the {plan.added} new{" "}
            {plan.added === 1 ? "author" : "authors"} will be sent to Wikidata.
          </p>
          <footer className="dialog-actions">
            <button className="ghost" onClick={() => setStage({ kind: "idle" })}>
              Back
            </button>
            <button
              className="primary"
              disabled={plan.books.length === 0}
              onClick={async () => {
                setStage({ kind: "saving" });
                await onImport(selected, updateExisting);
                onClose();
              }}
            >
              {plan.books.length === 0
                ? "Nothing to import"
                : `Import ${plan.books.length} ${plan.books.length === 1 ? "book" : "books"}`}
            </button>
          </footer>
        </>
      )}

      {stage.kind === "saving" && <p>Importing…</p>}
    </Dialog>
  );
}
