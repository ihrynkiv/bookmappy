import { useState } from "react";

/**
 * Book covers, with a drawn fallback rather than an empty box.
 *
 * Open Library answers a missing cover with HTTP 200 and a 43-byte blank image
 * unless you ask for `?default=false`, which 404s instead — that is what lets
 * `onError` fire here. Cover URLs are built with that flag; this guards the
 * case anyway, since imported libraries may carry older URLs.
 */
type Props = { title: string; author: string; url: string | null; size?: "normal" | "small" };

/** Stable hue per author, so an author's books share a colour on the shelf. */
function hue(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) % 360;
  return h;
}

function initial(title: string): string {
  const first = title.trim().replace(/^(the|a|an)\s+/i, "").charAt(0);
  return (first || "?").toUpperCase();
}

export function Cover({ title, author, url, size = "normal" }: Props) {
  const [failed, setFailed] = useState(false);
  const className = `cover${size === "small" ? " small" : ""}`;

  if (url && !failed) {
    return (
      <img
        className={className}
        src={url}
        alt=""
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const h = hue(author || title);
  return (
    <span
      className={`${className} cover-fallback`}
      style={{
        background: `linear-gradient(145deg, hsl(${h} 52% 62%), hsl(${(h + 38) % 360} 48% 44%))`,
      }}
      aria-hidden="true"
    >
      <span className="cover-spine" />
      <span className="cover-initial">{initial(title)}</span>
    </span>
  );
}
