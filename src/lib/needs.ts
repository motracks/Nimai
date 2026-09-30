import bigfiveContent from "@/lib/analysis/bigfive.json";
import ecrrContent from "@/lib/analysis/ecrr.json";
import gunaContent from "@/lib/analysis/guna.json";
import { levelOf } from "@/lib/analysis";
import { checkinLean, type CheckinAnswers } from "@/lib/checkin";
import { seasonFor, SEASON_LABEL, type Hemisphere } from "@/lib/context";
import type { InstrumentKey } from "@/lib/instruments";
import type { InstrumentHistory, ResultSnapshot } from "@/lib/results";

// "What does this person need now?" Each item names the layer that produced
// it, how sure it is, and the data behind it. Current state outranks
// temperament, which outranks nature; lower confidence moves an item down.

export type Layer = "current state" | "check-in" | "season" | "temperament" | "nature";
export type Confidence = "high" | "medium" | "low";

export interface Need {
  layer: Layer;
  title: string;
  detail: string;
  confidence: Confidence;
  why: string;
  href: string;
}

type Histories = Partial<Record<InstrumentKey, InstrumentHistory>>;
type Dosha = "VAT" | "PIT" | "KAP";
const NAME: Record<Dosha, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };
const SEASON_DOSHA = { spring: "KAP", summer: "PIT", autumn: "VAT", winter: "KAP" } as const;

const DAY = 24 * 60 * 60 * 1000;
const LAYER_RANK: Record<Layer, number> = { "current state": 0, "check-in": 1, season: 2, temperament: 3, nature: 4 };
const CONF_RANK: Record<Confidence, number> = { high: 0, medium: 1, low: 2 };
const lower = (c: Confidence): Confidence => (c === "high" ? "medium" : "low");
const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });

// Confidence from the data itself: answer-quality flags and how old it is.
function confidenceOf(snap: ResultSnapshot, freshDays: number, now: number): Confidence {
  let c: Confidence = "high";
  if (snap.scored?.quality.flags.length) c = lower(c);
  if (now - new Date(snap.completedAt).getTime() > freshDays * DAY) c = lower(c);
  return c;
}

export function needs(h: Histories, now = new Date(), checkin: { completedAt: string; answers: CheckinAnswers } | null = null): Need[] {
  const t = now.getTime();
  const out: Need[] = [];

  const v = h.vikriti?.latest;
  if (v?.scored) {
    const raised = (["VAT", "PIT", "KAP"] as Dosha[])
      .filter((d) => levelOf("vikriti", v.scored!, d) === "high")
      .sort((a, b) => v.scored!.raw[b] - v.scored!.raw[a]);
    for (const d of raised) {
      out.push({
        layer: "current state",
        title: `Settle ${NAME[d]}`,
        detail: `${NAME[d]} is raised right now. The Today card and the Vikriti reading have what to do and what to go easy on.`,
        confidence: confidenceOf(v, 42, t),
        why: `Vikriti check on ${fmt(v.completedAt)}: ${v.scored.raw[d]} of 6.`,
        href: "/results/vikriti",
      });
    }
  }

  const lean = checkin && t - new Date(checkin.completedAt).getTime() <= 7 * DAY ? checkinLean(checkin.answers) : null;
  if (lean && !out.some((n) => n.title === `Settle ${lean.name}`)) {
    out.push({
      layer: "check-in",
      title: `Watch ${lean.name}`,
      detail: `Your latest check-in leans ${lean.name}. A full Vikriti check would confirm it.`,
      confidence: lean.count >= 3 ? "medium" : "low",
      why: `Check-in on ${fmt(checkin!.completedAt)}: ${lean.count} of 4 answers.`,
      href: "/checkin",
    });
  }

  const g = h.guna?.latest;
  if (g?.scored?.shares) {
    const lead = Object.entries(g.scored.shares).sort((a, b) => b[1] - a[1])[0][0] as "SAT" | "RAJ" | "TAM";
    if (lead !== "SAT") {
      out.push({
        layer: "current state",
        title: lead === "TAM" ? "Build momentum" : "Slow down",
        detail: lead === "TAM" ? gunaContent.three_stages.tamas_to_rajas : gunaContent.three_stages.rajas_to_sattva,
        confidence: confidenceOf(g, 42, t),
        why: `Guna on ${fmt(g.completedAt)}: ${lead === "TAM" ? "Tamas" : "Rajas"} leads at ${Math.round(g.scored.shares[lead])}%.`,
        href: "/results/guna",
      });
    }
  }

  const hemisphere: Hemisphere = [h.vikriti, h.guna].map((x) => x?.latest.context?.hemisphere).find(Boolean) ?? "north";
  const season = seasonFor(now, hemisphere);
  const seasonDosha = SEASON_DOSHA[season];
  const p = h.prakriti?.latest.scored?.shares;
  const constitution = p ? (Object.entries(p).sort((a, b) => b[1] - a[1])[0][0] as Dosha) : null;
  if (!out.some((n) => n.title.endsWith(NAME[seasonDosha]))) {
    out.push({
      layer: "season",
      title: `${SEASON_LABEL[season]}: keep ${NAME[seasonDosha]} in check`,
      detail: `${NAME[seasonDosha]} tends to build up now (Svoboda, Ayurveda: Life, Health and Longevity, ch.4).`,
      confidence: constitution === seasonDosha ? "medium" : "low",
      why: constitution === seasonDosha ? `It's ${NAME[seasonDosha]}'s season and your constitution leans ${NAME[seasonDosha]}.` : `The time of year.`,
      href: "/sources#svobodalife1992",
    });
  }

  const b = h.bigfive?.latest;
  if (b?.scored && levelOf("bigfive", b.scored, "NEU") === "high") {
    out.push({
      layer: "temperament",
      title: "Steady the nervous system",
      detail: bigfiveContent.dimensions.NEU.high.watch,
      confidence: confidenceOf(b, 365, t),
      why: `Big Five on ${fmt(b.completedAt)}: high emotional reactivity.`,
      href: "/results/bigfive",
    });
  }
  const e = h.ecrr?.latest;
  const pattern = e?.scored?.classification.label as keyof typeof ecrrContent.patterns | undefined;
  if (e?.scored && pattern && pattern !== "Secure" && ecrrContent.patterns[pattern]) {
    out.push({
      layer: "temperament",
      title: "In relationships",
      detail: ecrrContent.patterns[pattern].growth[0],
      confidence: confidenceOf(e, 365, t),
      why: `Attachment on ${fmt(e.completedAt)}: ${pattern}.`,
      href: "/results/ecrr",
    });
  }

  if (constitution && constitution !== seasonDosha && !out.some((n) => n.title.endsWith(NAME[constitution]))) {
    out.push({
      layer: "nature",
      title: `Keep your ${NAME[constitution]} constitution steady`,
      detail: `Your nature leans ${NAME[constitution]}, so its imbalances are the ones most likely to come back.`,
      confidence: "low",
      why: `Prakriti on ${fmt(h.prakriti!.latest.completedAt)}.`,
      href: "/results/prakriti",
    });
  }

  return out
    .map((n, i) => ({ n, i }))
    .sort((a, b) => LAYER_RANK[a.n.layer] + CONF_RANK[a.n.confidence] - (LAYER_RANK[b.n.layer] + CONF_RANK[b.n.confidence]) || a.i - b.i)
    .map(({ n }) => n)
    .slice(0, 4);
}
