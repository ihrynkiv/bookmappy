import { formatRating, isWholeStar } from "../lib/rating";

/**
 * Five stars filled to the exact rating, so a 4.25 shows a quarter of the
 * fifth star. The figure is spelled out beside fractional ratings, since a
 * quarter of a 12px star is easy to miss; whole ratings read fine as stars.
 */
export function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span className="rating">—</span>;
  const label = `${formatRating(rating)} out of 5`;
  return (
    <span className="rating" title={label}>
      <span className="stars" role="img" aria-label={label}>
        <span className="stars-empty">★★★★★</span>
        <span className="stars-fill" style={{ width: `${(rating / 5) * 100}%` }}>
          ★★★★★
        </span>
      </span>
      {!isWholeStar(rating) && <span className="rating-value">{formatRating(rating)}</span>}
    </span>
  );
}
