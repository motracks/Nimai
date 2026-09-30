// Where and when a state test (Vikriti, Guna) was taken. Only the hemisphere is
// kept, never a place: it is enough to name the season, and seasons are what
// the comparisons need.

export type Hemisphere = "north" | "south";
export type Season = "winter" | "spring" | "summer" | "autumn";
export type Climate = "similar" | "warmer" | "colder" | "more humid" | "drier";

export interface ResultContext {
  hemisphere: Hemisphere;
  season: Season;
  away: boolean;
  climate: Climate | null; // only when away
}

export const CLIMATES: Climate[] = ["similar", "warmer", "colder", "more humid", "drier"];

// Time zones clearly south of the equator. Anything else defaults to north;
// the person can correct it on the form.
const SOUTH = [
  /^Australia\//,
  /^Antarctica\//,
  /^Pacific\/(Auckland|Chatham|Fiji|Tongatapu|Apia|Noumea|Efate|Rarotonga|Tahiti)$/,
  /^America\/(Argentina\/.*|Buenos_Aires|Santiago|Sao_Paulo|Montevideo|Asuncion|La_Paz|Lima|Punta_Arenas|Campo_Grande|Cuiaba|Porto_Velho|Recife|Bahia|Maceio|Fortaleza|Belem)$/,
  /^Africa\/(Johannesburg|Maputo|Harare|Windhoek|Gaborone|Lusaka|Maseru|Mbabane|Blantyre|Lubumbashi|Luanda|Dar_es_Salaam)$/,
  /^Indian\/(Mauritius|Reunion|Antananarivo|Mayotte|Comoro)$/,
  /^Atlantic\/(St_Helena|Stanley)$/,
];

export function hemisphereFromTimeZone(tz: string | undefined): Hemisphere {
  return tz && SOUTH.some((re) => re.test(tz)) ? "south" : "north";
}

// Meteorological seasons: whole months, the same convention weather services use.
const NORTH_SEASONS: Season[] = ["winter", "winter", "spring", "spring", "spring", "summer", "summer", "summer", "autumn", "autumn", "autumn", "winter"];
const FLIP: Record<Season, Season> = { winter: "summer", summer: "winter", spring: "autumn", autumn: "spring" };

export function seasonFor(date: Date, hemisphere: Hemisphere): Season {
  const s = NORTH_SEASONS[date.getUTCMonth()];
  return hemisphere === "north" ? s : FLIP[s];
}

// The year a season "belongs to": northern winter spans December-February, so
// December counts with the following January.
export function seasonYear(date: Date, hemisphere: Hemisphere): number {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth();
  const winterSpansYears = hemisphere === "north";
  return winterSpansYears && m === 11 ? y + 1 : y;
}

// Validates what the form sent; the season is always worked out here, never
// trusted from the client.
export function parseContext(input: unknown, now = new Date()): ResultContext | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  const hemisphere = o.hemisphere === "south" ? "south" : o.hemisphere === "north" ? "north" : null;
  if (!hemisphere || typeof o.away !== "boolean") return null;
  const climate = o.away && CLIMATES.includes(o.climate as Climate) ? (o.climate as Climate) : null;
  return { hemisphere, season: seasonFor(now, hemisphere), away: o.away, climate };
}

export const SEASON_LABEL: Record<Season, string> = { winter: "Winter", spring: "Spring", summer: "Summer", autumn: "Autumn" };

export function describeContext(c: ResultContext): string {
  const where = c.away ? `away from home${c.climate && c.climate !== "similar" ? `, ${c.climate} than home` : ""}` : "at home";
  return `${SEASON_LABEL[c.season]}, ${where}`;
}
