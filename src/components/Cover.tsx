import { useState } from "react";
import { MIN_REAL_COVER_PX, coverHue, coverInitial, withDefaultFalse } from "../lib/covers";

/**
 * Book covers, with a drawn fallback rather than an empty box.
 *
 * Open Library answers a missing cover with HTTP 200 and a 1x1 transparent GIF
 * unless you ask for `?default=false`, which 404s instead. Two consequences are
 * handled here: URLs are normalised so the flag is always present (libraries
 * imported before the flag existed carry unflagged URLs, and normalising beats
 * migrating stored data), and an image that loads but turns out to be 1x1 is
 * treated as missing anyway.
 */
type Props = { title: string; author: string; url: string | null; size?: "normal" | "small" };

export function Cover({ title, author, url, size = "normal" }: Props) {
  // Keyed by URL rather than a bare boolean, so a book whose cover changes gets
  // a fresh attempt instead of inheriting the previous failure.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const src = withDefaultFalse(url);
  const className = `cover${size === "small" ? " small" : ""}`;

  if (src && failedUrl !== src) {
    return (
      <img
        className={className}
        src={src}
        alt=""
        loading="lazy"
        onError={() => setFailedUrl(src)}
        onLoad={(e) => {
          if (e.currentTarget.naturalWidth <= MIN_REAL_COVER_PX) setFailedUrl(src);
        }}
      />
    );
  }

  const h = coverHue(author || title);
  return (
    <span
      className={`${className} cover-fallback`}
      style={{
        background: `linear-gradient(145deg, hsl(${h} 52% 62%), hsl(${(h + 38) % 360} 48% 44%))`,
      }}
      aria-hidden="true"
    >
      <span className="cover-spine" />
      <span className="cover-initial">{coverInitial(title)}</span>
    </span>
  );
}
