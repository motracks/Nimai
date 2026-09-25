import "@supabase/functions-js/edge-runtime.d.ts";
import { load, Constants } from "npm:@fusionstrings/swiss-eph@0.1.1";
import nakshatras from "./nakshatras.json" with { type: "json" };

const OPENCAGE_API_KEY = Deno.env.get("OPENCAGE_API_KEY") ?? "";
const TIMEZONEDB_API_KEY = Deno.env.get("TIMEZONEDB_API_KEY") ?? "";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ZODIAC_SIGNS = [
  "Aries", "Taurus", "Gemini", "Cancer", "Leo", "Virgo",
  "Libra", "Scorpio", "Sagittarius", "Capricorn", "Aquarius", "Pisces",
];

const GRAHAS = [
  { name: "Sun", ipl: Constants.SE_SUN },
  { name: "Moon", ipl: Constants.SE_MOON },
  { name: "Mars", ipl: Constants.SE_MARS },
  { name: "Mercury", ipl: Constants.SE_MERCURY },
  { name: "Jupiter", ipl: Constants.SE_JUPITER },
  { name: "Venus", ipl: Constants.SE_VENUS },
  { name: "Saturn", ipl: Constants.SE_SATURN },
  { name: "Rahu", ipl: Constants.SE_TRUE_NODE },
] as const;

// Fetch the WASM binary explicitly rather than letting the library resolve
// it relative to import.meta.url — that path resolution breaks once Deno
// Edge Runtime relocates npm: packages into its own bundler cache. Cached per
// worker so warm requests don't download it again; a failed fetch is retried
// on the next request.
let wasmBytesPromise: Promise<Uint8Array> | null = null;

function getWasmBytes(): Promise<Uint8Array> {
  wasmBytesPromise ??= fetch(
    "https://cdn.jsdelivr.net/npm/@fusionstrings/swiss-eph@0.1.1/wasm/swiss_eph.wasm",
  ).then(async (res) => {
    if (!res.ok) throw new Error(`Failed to fetch swiss-eph WASM: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  });
  wasmBytesPromise.catch(() => {
    wasmBytesPromise = null;
  });
  return wasmBytesPromise;
}

interface RequestBody {
  birth_date: string; // "YYYY-MM-DD"
  birth_time: string | null; // "HH:MM", null when unknown
  birth_place_text: string;
}

interface GeocodeResult {
  lat: number;
  lng: number;
  formatted: string;
}

async function geocode(place: string): Promise<GeocodeResult> {
  if (!OPENCAGE_API_KEY) throw new Error("OPENCAGE_API_KEY not configured");

  const url = new URL("https://api.opencagedata.com/geocode/v1/json");
  url.searchParams.set("q", place);
  url.searchParams.set("key", OPENCAGE_API_KEY);
  url.searchParams.set("limit", "1");
  url.searchParams.set("no_annotations", "1");

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenCage request failed: ${res.status}`);
  const data = await res.json();

  const result = data.results?.[0];
  if (!result) throw new Error(`No geocoding results for: ${place}`);

  return {
    lat: result.geometry.lat,
    lng: result.geometry.lng,
    formatted: result.formatted,
  };
}

interface TimezoneResult {
  timezone: string;
  offsetHours: number;
}

async function resolveTimezone(lat: number, lng: number, dateStr: string): Promise<TimezoneResult> {
  if (!TIMEZONEDB_API_KEY) throw new Error("TIMEZONEDB_API_KEY not configured");

  // Reference timestamp at noon UTC on the birth date — enough for TimeZoneDB
  // to resolve the correct historical zone/DST rule for that date.
  const refTimestamp = Math.floor(new Date(`${dateStr}T12:00:00Z`).getTime() / 1000);

  const url = new URL("https://api.timezonedb.com/v2.1/get-time-zone");
  url.searchParams.set("key", TIMEZONEDB_API_KEY);
  url.searchParams.set("format", "json");
  url.searchParams.set("by", "position");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lng", String(lng));
  url.searchParams.set("time", String(refTimestamp));

  const res = await fetch(url);
  if (!res.ok) throw new Error(`TimeZoneDB request failed: ${res.status}`);
  const data = await res.json();

  if (data.status !== "OK") throw new Error(`TimeZoneDB error: ${data.message ?? "unknown"}`);

  return {
    timezone: data.zoneName,
    offsetHours: data.gmtOffset / 3600,
  };
}

function signAndDegree(siderealLongitude: number) {
  const norm = ((siderealLongitude % 360) + 360) % 360;
  const signIndex = Math.floor(norm / 30);
  return {
    sign: ZODIAC_SIGNS[signIndex],
    degree_in_sign: Math.round((norm - signIndex * 30) * 100) / 100,
  };
}

const NAKSHATRA_SPAN = 360 / 27;
const PADA_SPAN = NAKSHATRA_SPAN / 4;

function nakshatraAndPada(moonSiderealLongitude: number) {
  const norm = ((moonSiderealLongitude % 360) + 360) % 360;
  const nakshatraIndex = Math.min(26, Math.floor(norm / NAKSHATRA_SPAN));
  const withinNakshatra = norm - nakshatraIndex * NAKSHATRA_SPAN;
  const pada = Math.min(4, Math.floor(withinNakshatra / PADA_SPAN) + 1);
  return {
    name: nakshatras.nakshatras[nakshatraIndex].name,
    pada,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const body: RequestBody = await req.json();
    const { birth_date, birth_time, birth_place_text } = body;

    if (!birth_date || !birth_place_text) {
      return new Response(JSON.stringify({ error: "birth_date and birth_place_text are required" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const ascendantReliable = Boolean(birth_time);
    const effectiveTime = birth_time ?? "12:00";
    const [hour, minute] = effectiveTime.split(":").map(Number);

    const location = await geocode(birth_place_text);
    const tz = await resolveTimezone(location.lat, location.lng, birth_date);

    const [year, month, day] = birth_date.split("-").map(Number);

    // Local civil time -> UT, using the resolved historical offset for this date.
    const localDecimalHour = hour + minute / 60;
    const utDecimalHour = localDecimalHour - tz.offsetHours;

    const swe = await load({ wasmSource: await getWasmBytes() });
    swe.swe_set_sid_mode(Constants.SE_SIDM_LAHIRI, 0, 0);

    const jdUt = swe.swe_julday(year, month, day, utDecimalHour, Constants.SE_GREG_CAL);

    const iflag = Constants.SEFLG_MOSEPH | Constants.SEFLG_SIDEREAL | Constants.SEFLG_SPEED;

    const longitudeAt = (jd: number, name: string, ipl: number) => {
      const { xx, returnCode, error } = swe.swe_calc_ut(jd, ipl, iflag);
      if (returnCode < 0) throw new Error(`swe_calc_ut failed for ${name}: ${error}`);
      return xx[0] as number;
    };

    let rahuLongitude = 0;
    const planets = GRAHAS.map(({ name, ipl }) => {
      const longitude = longitudeAt(jdUt, name, ipl);
      if (name === "Rahu") rahuLongitude = longitude;
      const { sign, degree_in_sign } = signAndDegree(longitude);
      const { name: nakName, pada } = nakshatraAndPada(longitude);
      return { name: name as string, sign, degree_in_sign, nakshatra: nakName, pada };
    });

    // Ketu is always exactly opposite Rahu (from the unrounded longitude).
    const ketuLongitude = (rahuLongitude + 180) % 360;
    const ketuSignDeg = signAndDegree(ketuLongitude);
    const ketuNak = nakshatraAndPada(ketuLongitude);
    planets.push({
      name: "Ketu",
      sign: ketuSignDeg.sign,
      degree_in_sign: ketuSignDeg.degree_in_sign,
      nakshatra: ketuNak.name,
      pada: ketuNak.pada,
    });

    const moon = planets.find((p) => p.name === "Moon")!;

    // The Moon moves ~13 degrees a day, about one nakshatra. Without a birth
    // time the noon position is only a guess, so check the whole local day and
    // report every sign and nakshatra the Moon passes through.
    let moonReliable = true;
    let moonRange: { signs: string[]; nakshatras: string[] } | null = null;
    if (!ascendantReliable) {
      const dayStartUt = 0 - tz.offsetHours;
      const signs = new Set<string>();
      const naks = new Set<string>();
      for (let h = 0; h <= 24; h += 1) {
        const hour = Math.min(h, 23 + 59 / 60);
        const jd = swe.swe_julday(year, month, day, dayStartUt + hour, Constants.SE_GREG_CAL);
        const lon = longitudeAt(jd, "Moon", Constants.SE_MOON);
        signs.add(signAndDegree(lon).sign);
        naks.add(nakshatraAndPada(lon).name);
      }
      moonReliable = signs.size === 1 && naks.size === 1;
      moonRange = { signs: [...signs], nakshatras: [...naks] };
    }

    let ascendant = null;
    let houses = null;

    if (ascendantReliable) {
      const { ascmc, returnCode } = swe.swe_houses_ex(
        jdUt,
        Constants.SEFLG_SIDEREAL,
        location.lat,
        location.lng,
        "W".charCodeAt(0),
      );
      if (returnCode < 0) throw new Error("swe_houses_ex failed");

      const ascLongitude = ascmc[0];
      const ascSignDeg = signAndDegree(ascLongitude);
      ascendant = ascSignDeg;

      const ascSignIndex = ZODIAC_SIGNS.indexOf(ascSignDeg.sign);
      houses = Array.from({ length: 12 }, (_, i) => ({
        house_number: i + 1,
        sign: ZODIAC_SIGNS[(ascSignIndex + i) % 12],
      }));
    }

    swe.close();

    const chandraLagna = { sign: moon.sign };
    const moonNakshatra = { name: moon.nakshatra, pada: moon.pada };

    return new Response(
      JSON.stringify({
        planets,
        ascendant,
        ascendant_reliable: ascendantReliable,
        houses,
        chandra_lagna: chandraLagna,
        moon_nakshatra: moonNakshatra,
        moon_reliable: moonReliable,
        moon_range: moonRange,
        engine: { ephemeris: "moshier", ayanamsa: "lahiri", house_system: "whole_sign", version: "2" },
        resolved_location: location.formatted,
        resolved_timezone: tz.timezone,
      }),
      { headers: { ...CORS_HEADERS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
