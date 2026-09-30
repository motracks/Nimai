// Single registry of the questionnaire instruments: which version of the
// questions is live, which version of the scoring rules is live, and how the
// instrument is meant to be retaken. Bump scoringVersion whenever scoring.ts or
// a *_mapping.json rule changes; bump instrumentVersion whenever items change.
// Stored rows carry both, so old results stay readable after either changes.

export type InstrumentKey = "bigfive" | "ecrr" | "guna" | "prakriti" | "vikriti";

// What a retake means for this instrument:
// - "constitution": fixed by nature (Prakriti). Retakes check consistency, not growth.
// - "trait": slow-moving (Big Five, attachment). Change shows over months.
// - "state": expected to move with practice, season and lifestyle (Guna, Vikriti).
export type InstrumentKind = "constitution" | "trait" | "state";

export interface InstrumentMeta {
  key: InstrumentKey;
  label: string;
  instrumentVersion: string;
  scoringVersion: string;
  kind: InstrumentKind;
  suggestedRetakeDays: number;
  testHref: string;
}

export const INSTRUMENTS: Record<InstrumentKey, InstrumentMeta> = {
  bigfive: {
    key: "bigfive",
    label: "Big Five Personality",
    instrumentVersion: "ipip50-6pt",
    scoringVersion: "2",
    kind: "trait",
    suggestedRetakeDays: 180,
    testHref: "/bigfive",
  },
  ecrr: {
    key: "ecrr",
    label: "Attachment Style (ECR-R)",
    instrumentVersion: "ecrr36-6pt",
    scoringVersion: "2",
    kind: "trait",
    suggestedRetakeDays: 180,
    testHref: "/ecrr",
  },
  guna: {
    key: "guna",
    label: "Guna (Sattva/Rajas/Tamas)",
    instrumentVersion: "guna36-6pt",
    scoringVersion: "2",
    kind: "state",
    suggestedRetakeDays: 30,
    testHref: "/guna",
  },
  prakriti: {
    key: "prakriti",
    label: "Prakriti (Vata/Pitta/Kapha)",
    instrumentVersion: "govardhan40",
    scoringVersion: "2",
    kind: "constitution",
    suggestedRetakeDays: 365,
    testHref: "/prakriti",
  },
  vikriti: {
    key: "vikriti",
    label: "Vikriti (current state)",
    instrumentVersion: "govardhan-vk6",
    scoringVersion: "1",
    kind: "state",
    suggestedRetakeDays: 28,
    testHref: "/vikriti",
  },
};

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS) as InstrumentKey[];

// Retaking soon after a result mostly measures memory of the previous answers.
// Traits and the constitution are blocked inside this window; states are
// expected to move, so they only get a warning.
export const MIN_RETAKE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export type RetakeCheck =
  | { status: "ok" }
  | { status: "blocked" | "warn"; daysSince: number; availableOn: Date };

export function retakeCheck(key: InstrumentKey, lastCompletedAt: string | null, now = Date.now()): RetakeCheck {
  if (!lastCompletedAt) return { status: "ok" };
  const last = new Date(lastCompletedAt).getTime();
  if (now - last >= MIN_RETAKE_DAYS * DAY_MS) return { status: "ok" };
  return {
    status: INSTRUMENTS[key].kind === "state" ? "warn" : "blocked",
    daysSince: Math.floor((now - last) / DAY_MS),
    availableOn: new Date(last + MIN_RETAKE_DAYS * DAY_MS),
  };
}

export function isInstrumentKey(value: unknown): value is InstrumentKey {
  return typeof value === "string" && value in INSTRUMENTS;
}
