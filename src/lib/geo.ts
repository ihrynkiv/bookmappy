import { feature } from "topojson-client";
import type { Feature, FeatureCollection, Geometry } from "geojson";
import world from "world-atlas/countries-110m.json";
import { COUNTRIES } from "../data/countries.generated";

/**
 * The world-atlas TopoJSON keys each country by its numeric ISO code, while the
 * rest of the app speaks alpha-2. This module is the only place that bridges
 * the two.
 */
const NUMERIC_TO_ISO: Record<string, string> = Object.fromEntries(
  Object.entries(COUNTRIES).map(([iso, { num }]) => [String(Number(num)), iso]),
);

/**
 * Three atlas polygons carry no numeric ISO code because their status is
 * disputed. Painting them with the country they are administered as (or, for
 * Kosovo, its user-assigned code) beats leaving holes in the map.
 */
const BY_ATLAS_NAME: Record<string, string> = {
  Kosovo: "XK",
  "N. Cyprus": "CY",
  Somaliland: "SO",
};

export type CountryFeature = Feature<Geometry, { name: string }> & { iso: string | null };

const collection = feature(
  world as never,
  (world as never as { objects: { countries: unknown } }).objects.countries as never,
) as unknown as FeatureCollection<Geometry, { name: string }>;

export const COUNTRY_FEATURES: CountryFeature[] = collection.features.map((f) => ({
  ...f,
  iso: NUMERIC_TO_ISO[String(Number(f.id))] ?? BY_ATLAS_NAME[f.properties.name] ?? null,
}));

export function countryName(iso: string): string {
  return COUNTRIES[iso]?.name ?? iso;
}

/** Every country, alphabetically — backs the manual-override picker. */
export const ALL_COUNTRIES = Object.entries(COUNTRIES)
  .map(([iso, { name }]) => ({ iso, name }))
  .sort((a, b) => a.name.localeCompare(b.name));
