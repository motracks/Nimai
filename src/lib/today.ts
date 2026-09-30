import doshaGuide from "@/lib/prakriti_dosha_guide.json";
import gunaContent from "@/lib/analysis/guna.json";
import { levelOf } from "@/lib/analysis";
import { seasonFor, SEASON_LABEL, type Hemisphere, type Season } from "@/lib/context";
import type { InstrumentHistory } from "@/lib/results";
import type { InstrumentKey } from "@/lib/instruments";
import { checkinLean, type CheckinAnswers } from "@/lib/checkin";

type Dosha = "VAT" | "PIT" | "KAP";
const NAME: Record<Dosha, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };

// Which dosha each temperate season aggravates (Svoboda, Ayurveda: Life,
// Health and Longevity, ch.4): Kapha in spring, Pitta in summer, Vata in
// autumn; winter builds up Kapha for spring.
const SEASON_DOSHA: Record<Season, Dosha> = { spring: "KAP", summer: "PIT", autumn: "VAT", winter: "KAP" };

export interface TodayFocus {
  dosha: Dosha;
  name: string;
  reason: string;
  do: string[];
  avoid: string[];
  guna: string | null;
  href: string; // where the fuller reading lives
}

type Histories = Partial<Record<InstrumentKey, InstrumentHistory>>;

function leading(scores: Record<string, number>): Dosha {
  return (Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0] as Dosha) ?? "VAT";
}

// Current state outranks nature: a raised Vikriti comes first, then the
// season's dosha when it matches the constitution, then the constitution,
// then the season alone.
// A check-in counts for a week, and only when it's newer than the last Vikriti.
const CHECKIN_DAYS = 7;

export function todayFocus(
  h: Histories,
  now = new Date(),
  checkin: { completedAt: string; answers: CheckinAnswers } | null = null,
): TodayFocus | null {
  const vikriti = h.vikriti?.latest.scored ?? null;
  const prakriti = h.prakriti?.latest.scored ?? null;
  const hemisphere: Hemisphere =
    [h.vikriti, h.guna].map((x) => x?.latest.context?.hemisphere).find(Boolean) ?? "north";
  const season = seasonFor(now, hemisphere);
  const seasonDosha = SEASON_DOSHA[season];
  const constitution = prakriti?.shares ? leading(prakriti.shares) : null;

  let dosha: Dosha;
  let reason: string;
  const raised = vikriti
    ? (["VAT", "PIT", "KAP"] as Dosha[]).filter((d) => levelOf("vikriti", vikriti, d) === "high").sort((a, b) => vikriti.raw[b] - vikriti.raw[a])
    : [];
  const checkinAt = checkin ? new Date(checkin.completedAt).getTime() : 0;
  const vikritiAt = h.vikriti ? new Date(h.vikriti.latest.completedAt).getTime() : 0;
  const lean =
    checkin && checkinAt > vikritiAt && now.getTime() - checkinAt <= CHECKIN_DAYS * 24 * 60 * 60 * 1000
      ? checkinLean(checkin.answers)
      : null;
  if (raised.length) {
    dosha = raised[0];
    reason = `Your latest Vikriti check shows ${NAME[dosha]} raised, so settling it comes first.`;
  } else if (lean) {
    dosha = lean.dosha;
    reason = `Your check-in this week leans ${lean.name} (${lean.count} of 4 answers). It's a lighter signal than a full Vikriti check, but it points here.`;
  } else if (constitution && constitution === seasonDosha) {
    dosha = constitution;
    reason = `It's ${SEASON_LABEL[season].toLowerCase()}, ${NAME[dosha]}'s season, and your constitution leans ${NAME[dosha]}: a good time to keep it steady.`;
  } else if (constitution) {
    dosha = constitution;
    reason = `Nothing is raised right now, so this follows your constitution, which leans ${NAME[dosha]}.`;
  } else if (vikriti) {
    dosha = seasonDosha;
    reason = `Nothing is raised right now. It's ${SEASON_LABEL[season].toLowerCase()}, when ${NAME[dosha]} tends to build up.`;
  } else return null;

  const g = doshaGuide.doshas[dosha];
  const gunaLead = h.guna?.latest.scored?.shares
    ? (Object.entries(h.guna.latest.scored.shares).sort((a, b) => b[1] - a[1])[0][0] as "SAT" | "RAJ" | "TAM")
    : null;

  return {
    dosha,
    name: NAME[dosha],
    reason,
    do: g.today.do.slice(0, 3),
    avoid: g.today.avoid.slice(0, 3),
    guna: gunaLead ? gunaContent.gunas[gunaLead].supports[0] : null,
    href: raised.length ? "/results/vikriti" : constitution ? "/results/prakriti" : "/results/vikriti",
  };
}

// The dosha of the hour, by local time (Svoboda, ch.4): Kapha from dawn to
// mid-morning, Pitta to mid-afternoon, Vata to dusk, and the same again by night.
export function doshaOfHour(hour: number): { dosha: Dosha; name: string; span: string; note: string } {
  const slots: [number, Dosha, string, string][] = [
    [2, "VAT", "2-6", "a junction hour, when Vata is strongest. Something warm and a pause help if you feel scattered."],
    [6, "KAP", "6-10", "inertia is strongest. Moving now helps most."],
    [10, "PIT", "10-2", "heat and digestion are at their peak."],
    [14, "VAT", "2-6", "a junction hour, when Vata is strongest. Something warm and a pause help if you feel scattered."],
    [18, "KAP", "6-10", "the body slows towards rest."],
    [22, "PIT", "10-2", "the body's heat turns to digesting the day. Sleep before it helps."],
  ];
  const [, dosha, span, note] = [...slots].reverse().find(([start]) => hour >= start) ?? slots[slots.length - 1];
  return { dosha, name: NAME[dosha], span, note };
}
