import { useMemo, useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { COUNTRY_FEATURES } from "../lib/geo";
import { metricValue } from "../lib/stats";
import type { CountryStat, Metric } from "../lib/types";

const WIDTH = 960;
const HEIGHT = 500;

/**
 * Five shades per metric, light to dark. Countries are bucketed by rank rather
 * than raw value so a single 40-book country cannot flatten everything else
 * into the palest shade.
 */
const SHADES = ["#dbeafe", "#93c5fd", "#4a90e2", "#2563eb", "#1e3a8a"];
const RATING_SHADES = ["#fee2e2", "#fed7aa", "#fde68a", "#a7f3d0", "#34d399"];
const EMPTY = "#eceff4";

type Props = {
  stats: Map<string, CountryStat>;
  metric: Metric;
  selected: string | null;
  onSelect: (iso: string | null) => void;
};

/**
 * Bucket boundaries from the distinct values actually present. Quantiles over
 * distinct values keep every shade in play even when most countries sit at one
 * or two books, which is what a real reading list looks like.
 */
function useScale(stats: Map<string, CountryStat>, metric: Metric) {
  return useMemo(() => {
    const values = [...stats.values()]
      .map((s) => metricValue(s, metric))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const distinct = [...new Set(values)];
    if (distinct.length === 0) return { bucket: () => -1, thresholds: [] as number[] };

    // Average rating is an absolute 1-5 scale; fixed cut points read far more
    // honestly than quantiles, which would make a 3.0 country look "green".
    if (metric === "avgRating") {
      const thresholds = [2, 3, 3.75, 4.5];
      return {
        bucket: (v: number) => thresholds.filter((t) => v >= t).length,
        thresholds,
      };
    }

    const thresholds: number[] = [];
    for (let i = 1; i < SHADES.length; i += 1) {
      const at = distinct[Math.floor((i / SHADES.length) * distinct.length)];
      if (at !== undefined && !thresholds.includes(at)) thresholds.push(at);
    }
    return {
      bucket: (v: number) => thresholds.filter((t) => v >= t).length,
      thresholds,
    };
  }, [stats, metric]);
}

export function WorldMap({ stats, metric, selected, onSelect }: Props) {
  const [hover, setHover] = useState<{ iso: string; x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const { bucket } = useScale(stats, metric);
  const palette = metric === "avgRating" ? RATING_SHADES : SHADES;

  const path = useMemo(() => {
    const projection = geoNaturalEarth1().fitExtent(
      [
        [4, 4],
        [WIDTH - 4, HEIGHT - 4],
      ],
      { type: "Sphere" },
    );
    return geoPath(projection);
  }, []);

  const hovered = hover ? stats.get(hover.iso) : null;

  return (
    <div className="map-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="map"
        role="img"
        aria-label="World map of countries you have read authors from"
        onMouseLeave={() => setHover(null)}
      >
        <rect width={WIDTH} height={HEIGHT} fill="transparent" onClick={() => onSelect(null)} />
        <g>
          {COUNTRY_FEATURES.map((f, i) => {
            const stat = f.iso ? stats.get(f.iso) : undefined;
            const value = metricValue(stat, metric);
            const fill = value === null ? EMPTY : palette[bucket(value)] ?? EMPTY;
            const isSelected = selected !== null && f.iso === selected;
            const d = path(f) ?? undefined;
            if (!d) return null;
            return (
              <path
                // Two atlas polygons can share an ISO (Cyprus/N. Cyprus,
                // Somalia/Somaliland), so the index is what makes the key unique.
                key={`${f.iso ?? "none"}-${i}`}
                d={d}
                fill={fill}
                className={`country${stat ? " has-books" : ""}${isSelected ? " selected" : ""}`}
                onMouseMove={(e) => {
                  const box = svgRef.current?.getBoundingClientRect();
                  if (!box || !f.iso) return;
                  setHover({
                    iso: f.iso,
                    x: e.clientX - box.left,
                    y: e.clientY - box.top,
                  });
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!f.iso || !stat) return;
                  onSelect(isSelected ? null : f.iso);
                }}
              >
                <title>{f.properties.name}</title>
              </path>
            );
          })}
        </g>
      </svg>

      {hover && hovered && (
        <div className="tooltip" style={{ left: hover.x, top: hover.y }}>
          <strong>{hovered.name}</strong>
          <span>
            {hovered.books} {hovered.books === 1 ? "book" : "books"} · {hovered.authors}{" "}
            {hovered.authors === 1 ? "author" : "authors"}
            {hovered.avgRating !== null && ` · ${hovered.avgRating.toFixed(1)}★`}
          </span>
        </div>
      )}

      <Legend palette={palette} metric={metric} />
    </div>
  );
}

function Legend({ palette, metric }: { palette: string[]; metric: Metric }) {
  return (
    <div className="legend">
      <span className="legend-label">{metric === "avgRating" ? "lower" : "fewer"}</span>
      <div className="legend-swatches">
        <span className="swatch" style={{ background: EMPTY }} title="none" />
        {palette.map((c) => (
          <span key={c} className="swatch" style={{ background: c }} />
        ))}
      </div>
      <span className="legend-label">{metric === "avgRating" ? "higher" : "more"}</span>
    </div>
  );
}
