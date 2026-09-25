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

export function isInstrumentKey(value: unknown): value is InstrumentKey {
  return typeof value === "string" && value in INSTRUMENTS;
}
