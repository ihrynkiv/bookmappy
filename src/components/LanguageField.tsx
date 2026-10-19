import { OTHER_LANGUAGES, PREFERRED_LANGUAGES } from "../lib/languages";

type Props = {
  id: string;
  value: string | null | undefined;
  onChange: (code: string | null) => void;
};

/** Optional language picker shared by the add and edit dialogs. */
export function LanguageField({ id, value, onChange }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>
        Language <span className="muted small">— optional, the one you read it in</span>
      </label>
      <select id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">— not set —</option>
        <LanguageOptions />
      </select>
    </div>
  );
}

/**
 * The pinned languages, a divider, then the rest alphabetically. Shared with
 * the bulk "Set language to…" picker so both read the same.
 */
export function LanguageOptions() {
  return (
    <>
      {PREFERRED_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
      <option disabled>──────────</option>
      {OTHER_LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.name}
        </option>
      ))}
    </>
  );
}
