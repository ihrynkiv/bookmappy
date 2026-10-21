import { formatRating, isWholeStar, RATING_STEPS } from "../lib/rating";

type Props = {
  id: string;
  value: number | null;
  onChange: (rating: number | null) => void;
};

/**
 * Rating picker in quarter stars, best first. Whole ratings carry their stars
 * so the list scans by eye; the quarters between them are plain figures. A
 * native select keeps it a one-tap wheel on phones, where tapping a quarter of
 * a star icon would be too fiddly.
 */
export function RatingField({ id, value, onChange }: Props) {
  return (
    <div className="field">
      <label htmlFor={id}>Rating</label>
      <select
        id={id}
        value={value ?? 0}
        onChange={(e) => onChange(Number(e.target.value) || null)}
      >
        <option value={0}>Unrated</option>
        {RATING_STEPS.map((n) => (
          <option key={n} value={n}>
            {isWholeStar(n) ? `${"★".repeat(n)} ${n}` : formatRating(n)}
          </option>
        ))}
      </select>
    </div>
  );
}
