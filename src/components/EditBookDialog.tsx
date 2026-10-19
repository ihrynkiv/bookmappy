import { useState } from "react";
import { ALL_COUNTRIES, countryName } from "../lib/geo";
import { countryForQid, resolveAuthor } from "../lib/wikidata";
import type { AuthorCandidate, Book } from "../lib/types";
import { Dialog } from "./Dialog";
import { LanguageField } from "./LanguageField";

type Props = {
  book: Book;
  onSave: (book: Book) => void;
  onClose: () => void;
};

/**
 * The escape hatch for everything automatic resolution gets wrong: pick a
 * different person of the same name, or just set the country by hand.
 */
export function EditBookDialog({ book, onSave, onClose }: Props) {
  const [draft, setDraft] = useState<Book>(book);
  const [candidates, setCandidates] = useState<AuthorCandidate[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadCandidates() {
    setBusy(true);
    try {
      const result = await resolveAuthor(draft.author);
      setCandidates(result.candidates);
    } finally {
      setBusy(false);
    }
  }

  async function chooseCandidate(candidate: AuthorCandidate) {
    setBusy(true);
    try {
      const { countryCode, note } = await countryForQid(candidate.qid);
      setDraft((d) => ({
        ...d,
        authorQid: candidate.qid,
        countryCode: countryCode ?? d.countryCode,
        countryManual: true,
        status: countryCode ? "resolved" : "no-country",
        note: countryCode ? note ?? `picked ${candidate.label}` : "no country on this person",
      }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog title="Edit book" onClose={onClose}>
      <div className="field">
        <label htmlFor="edit-title">Title</label>
        <input
          id="edit-title"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div className="field">
        <label htmlFor="edit-author">Author</label>
        <input
          id="edit-author"
          value={draft.author}
          onChange={(e) => setDraft({ ...draft, author: e.target.value })}
        />
      </div>

      <div className="row">
        <div className="field">
          <label htmlFor="edit-rating">Rating</label>
          <select
            id="edit-rating"
            value={draft.rating ?? 0}
            onChange={(e) =>
              setDraft({ ...draft, rating: Number(e.target.value) || null })
            }
          >
            <option value={0}>Unrated</option>
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {"★".repeat(n)}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="edit-date">Date read</label>
          <input
            id="edit-date"
            type="date"
            value={draft.dateRead ?? ""}
            onChange={(e) => setDraft({ ...draft, dateRead: e.target.value || null })}
          />
        </div>
        <div className="field">
          <label htmlFor="edit-shelf">Shelf</label>
          <select
            id="edit-shelf"
            value={draft.shelf}
            onChange={(e) => setDraft({ ...draft, shelf: e.target.value })}
          >
            <option value="read">read</option>
            <option value="currently-reading">currently-reading</option>
            <option value="to-read">to-read</option>
          </select>
        </div>
      </div>

      <LanguageField
        id="edit-language"
        value={draft.language}
        onChange={(language) => setDraft({ ...draft, language })}
      />

      <div className="field">
        <label htmlFor="edit-country">
          Country{" "}
          {draft.countryManual ? (
            <span className="pill">set by hand</span>
          ) : (
            draft.note && <span className="muted small">— {draft.note}</span>
          )}
        </label>
        <select
          id="edit-country"
          value={draft.countryCode ?? ""}
          onChange={(e) =>
            setDraft({
              ...draft,
              countryCode: e.target.value || null,
              countryManual: true,
              status: e.target.value ? "resolved" : "no-country",
              note: e.target.value ? "set by hand" : null,
            })
          }
        >
          <option value="">— none —</option>
          {ALL_COUNTRIES.map((c) => (
            <option key={c.iso} value={c.iso}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <button className="ghost" onClick={loadCandidates} disabled={busy}>
          {busy ? "Searching…" : "Find this author on Wikidata"}
        </button>
        {candidates.length > 0 && (
          <ul className="candidates">
            {candidates.map((c) => (
              <li key={c.qid}>
                <button
                  className={`candidate${c.qid === draft.authorQid ? " active" : ""}`}
                  onClick={() => chooseCandidate(c)}
                  disabled={busy}
                >
                  <strong>{c.label}</strong>
                  <span className="muted small">{c.description || "no description"}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {candidates.length === 0 && !busy && draft.status === "not-found" && (
          <p className="muted small">Wikidata has no author by this name — set the country by hand.</p>
        )}
      </div>

      <footer className="dialog-actions">
        <span className="muted small">
          {draft.countryCode ? `Maps to ${countryName(draft.countryCode)}` : "Not on the map"}
        </span>
        <div>
          <button className="ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="primary"
            onClick={() => onSave({ ...draft, updatedAt: Date.now() })}
          >
            Save
          </button>
        </div>
      </footer>
    </Dialog>
  );
}
