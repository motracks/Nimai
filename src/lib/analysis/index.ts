import bigfiveMapping from "../bigfive_mapping.json";
import ecrrMapping from "../ecrr_mapping.json";
import doshaGuide from "../prakriti_dosha_guide.json";
import { INSTRUMENTS, type InstrumentKey } from "../instruments";
import {
  FLAG_TEXT,
  classificationDescription,
  dimensionName,
  vikritiVsPrakriti,
  type InstrumentHistory,
} from "../results";
import type { ScoredResult } from "../scoring";
import bigfiveContent from "./bigfive.json";
import ecrrContent from "./ecrr.json";
import gunaContent from "./guna.json";

// Rule-based analysis of a single test result. Deterministic: the same result
// always produces the same text, every sentence comes from a content file,
// and no external API is involved. The content files sit next to this module
// so the wording can be edited without touching code.

export interface AnalysisSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export interface Analysis {
  instrument: InstrumentKey;
  headline: string;
  summary: string;
  sections: AnalysisSection[];
  progression: string | null;
  caveats: string[];
}

export type Level = "high" | "mid" | "low";

type Dosha = "VAT" | "PIT" | "KAP";
type DoshaGuideEntry = (typeof doshaGuide.doshas)[Dosha];

const SHARE_HIGH = 40;
const SHARE_LOW = 26;

function bandLevel(bands: { range: number[] }[], value: number): Level {
  const idx = bands.findIndex((b) => value <= b.range[1]);
  return idx === 0 ? "low" : idx === 1 ? "mid" : "high";
}

// Where a dimension sits, in the units that matter for that instrument.
export function levelOf(key: InstrumentKey, scored: ScoredResult, dim: string): Level {
  switch (key) {
    case "bigfive":
      return bandLevel(bigfiveMapping.dimensions[dim as keyof typeof bigfiveMapping.dimensions].bands, scored.raw[dim]);
    case "ecrr":
      return bandLevel(ecrrMapping.dimensions[dim as keyof typeof ecrrMapping.dimensions].bands, scored.raw[dim]);
    case "guna":
    case "prakriti": {
      const share = scored.shares![dim];
      return share >= SHARE_HIGH ? "high" : share <= SHARE_LOW ? "low" : "mid";
    }
    case "vikriti":
      return scored.raw[dim] >= 3 ? "high" : scored.raw[dim] <= 1 ? "low" : "mid";
  }
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

function byShare(scored: ScoredResult): string[] {
  const values = scored.shares ?? scored.norm;
  return Object.keys(values).sort((a, b) => values[b] - values[a]);
}

// ---------- progression ----------

export function progressionLine(history: InstrumentHistory | undefined): string | null {
  if (!history?.baseline) return null;
  const { key, baseline, latest, delta } = history;
  const since = `since your baseline (${formatDate(baseline.completedAt)})`;
  if (!baseline.comparable || !delta) return baseline.versionNote;

  if (INSTRUMENTS[key].kind === "constitution") {
    return baseline.scored?.classification.label === latest.scored?.classification.label
      ? `Consistent ${since}: the same constitution came out again.`
      : `Different ${since} (${baseline.scored?.classification.label}). For a constitution that calls for a careful re-check, not a conclusion that you have changed.`;
  }

  const moves = Object.entries(delta)
    .filter(([, d]) => Math.abs(d) >= 5)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([dim, d]) => `${dimensionName(key, dim)} ${d > 0 ? "+" : "−"}${Math.round(Math.abs(d))}`);

  const extra: string[] = [];
  if (key === "guna") {
    if (delta.SAT >= 5) extra.push(gunaContent.sattva_rising);
    if (delta.TAM >= 5) extra.push(gunaContent.tamas_rising);
  }
  const head = moves.length ? `Changes ${since}: ${moves.join(", ")} (points out of 100).` : `Steady ${since}.`;
  return [head, ...extra].join(" ");
}

function qualityCaveats(scored: ScoredResult): string[] {
  return scored.quality.flags.filter((f) => f !== "referral").map((f) => FLAG_TEXT[f] ?? f);
}

// ---------- per instrument ----------

function analyseBigFive(scored: ScoredResult): Omit<Analysis, "instrument" | "progression"> {
  const dims = Object.keys(scored.norm);
  const levels = Object.fromEntries(dims.map((d) => [d, levelOf("bigfive", scored, d)]));
  // Most distinctive = furthest from the middle of the scale.
  const distinctive = [...dims].sort((a, b) => Math.abs(scored.norm[b] - 50) - Math.abs(scored.norm[a] - 50));
  const top = distinctive.slice(0, 2).map((d) => scored.classification.dimensionLabels![d]);

  const strengths: string[] = [];
  const watch: string[] = [];
  const flexible: string[] = [];
  for (const d of distinctive) {
    const c = bigfiveContent.dimensions[d as keyof typeof bigfiveContent.dimensions][levels[d] as Level];
    if ("strength" in c) {
      strengths.push(c.strength);
      watch.push(c.watch);
    } else {
      flexible.push(`${dimensionName("bigfive", d)}: ${c.note}`);
    }
  }

  const combos = bigfiveContent.combinations
    .filter((c) => Object.entries(c.when).every(([d, lvl]) => levels[d] === lvl))
    .map((c) => c.text);

  const sections: AnalysisSection[] = [
    {
      title: "Your most distinctive traits",
      paragraphs: distinctive
        .slice(0, 2)
        .map((d) => bigfiveContent.dimensions[d as keyof typeof bigfiveContent.dimensions].about),
    },
  ];
  if (strengths.length) sections.push({ title: "Strengths", items: strengths });
  if (watch.length) sections.push({ title: "Worth watching", items: watch });
  if (flexible.length) sections.push({ title: "Where you flex", items: flexible });
  if (combos.length) sections.push({ title: "How your traits combine", paragraphs: combos });

  return {
    headline: `Most distinctive: ${top.join(" and ")}`,
    summary: distinctive
      .map((d) => `${scored.classification.dimensionLabels![d]} (${dimensionName("bigfive", d)})`)
      .join(", "),
    sections,
    caveats: qualityCaveats(scored),
  };
}

function strategyNotes(scored: ScoredResult): string[] {
  const cutoff = ecrrMapping.rules.cutoff;
  const notes: string[] = [];
  if (scored.raw.ANX > cutoff) notes.push(ecrrContent.dimension_notes.ANX_high);
  if (scored.raw.AVD > cutoff) notes.push(ecrrContent.dimension_notes.AVD_high);
  return notes.length ? notes : [ecrrContent.dimension_notes.both_low];
}

function analyseEcrr(scored: ScoredResult): Omit<Analysis, "instrument" | "progression"> {
  const label = scored.classification.label!;
  const content = ecrrContent.patterns[label as keyof typeof ecrrContent.patterns];
  const sections: AnalysisSection[] = [
    { title: "In practice", paragraphs: [content.in_practice] },
    {
      title: "Your two dimensions",
      items: (["ANX", "AVD"] as const).map(
        (d) => `${dimensionName("ecrr", d)}: ${scored.classification.dimensionLabels![d]} (${scored.raw[d]} on 1-6)`,
      ),
    },
    { title: "Why it works this way", paragraphs: strategyNotes(scored) },
    { title: "Ways to grow", items: content.growth },
    { title: "It can change", paragraphs: [ecrrContent.can_change] },
  ];

  const caveats = qualityCaveats(scored).filter((c) => c !== FLAG_TEXT.near_boundary);
  if (scored.quality.flags.includes("near_boundary")) {
    const cutoff = ecrrMapping.rules.cutoff;
    const flip = (dim: "ANX" | "AVD") => (scored.raw[dim] > cutoff ? "low" : "high");
    const nearDim = Math.abs(scored.raw.ANX - cutoff) <= Math.abs(scored.raw.AVD - cutoff) ? "ANX" : "AVD";
    const other = nearDim === "ANX" ? "AVD" : "ANX";
    const keep = scored.raw[other] > cutoff ? "high" : "low";
    const condition = nearDim === "ANX" ? `ANX ${flip("ANX")}, AVD ${keep}` : `ANX ${keep}, AVD ${flip("AVD")}`;
    const runnerUp = ecrrMapping.combined_patterns.find((p) => p.condition === condition)?.label ?? "";
    caveats.unshift(ecrrContent.near_boundary.replace("{runner_up}", runnerUp));
  }

  return {
    headline: label,
    summary: classificationDescription("ecrr", scored) ?? "",
    sections,
    caveats,
  };
}

function analyseGuna(scored: ScoredResult): Omit<Analysis, "instrument" | "progression"> {
  const [first] = byShare(scored) as ("SAT" | "RAJ" | "TAM")[];
  const lead = gunaContent.gunas[first];
  const shares = scored.shares!;

  const sections: AnalysisSection[] = [
    { title: `${dimensionName("guna", first)} leads`, paragraphs: [lead.leads] },
    {
      title: "The three together",
      items: (["SAT", "RAJ", "TAM"] as const).map(
        (d) => `${dimensionName("guna", d)}: ${Math.round(shares[d])}% · ${scored.classification.dimensionLabels![d]}`,
      ),
    },
    { title: "What supports you now", items: [...lead.supports, lead.food] },
    { title: "From the Bhagavad Gita", items: lead.gita },
  ];
  if (first !== "TAM" && scored.norm.TAM > scored.norm.SAT) {
    sections.splice(2, 0, { title: "Worth attention", paragraphs: [gunaContent.sattva_below_tamas] });
  }

  return {
    headline: scored.classification.label!,
    summary: classificationDescription("guna", scored) ?? "",
    sections,
    caveats: qualityCaveats(scored),
  };
}

function doshaSection(dosha: Dosha): AnalysisSection {
  const g: DoshaGuideEntry = doshaGuide.doshas[dosha];
  return {
    title: `${g.label}: ${g.element}`,
    paragraphs: [g.principle],
    items: [`In balance: ${g.in_balance}`, `Out of balance: ${g.out_of_balance}`, `Increased by: ${g.increased_by}`],
  };
}

function practiceSection(dosha: Dosha, title: string): AnalysisSection {
  const g: DoshaGuideEntry = doshaGuide.doshas[dosha];
  return {
    title,
    items: [`Asana: ${g.asana}`, `Pranayama: ${g.pranayama}`, `Meditation: ${g.meditation}`],
  };
}

// Doshas named in the classification, per the guide's display rules: never
// show a dosha's block unless it is the person's dominant or secondary dosha.
function namedDoshas(scored: ScoredResult): Dosha[] {
  const order = byShare(scored) as Dosha[];
  switch (scored.classification.key) {
    case "ekadosha":
      return order.slice(0, 1);
    case "dvandva":
      return order.slice(0, 2);
    default:
      return [];
  }
}

function analysePrakriti(scored: ScoredResult): Omit<Analysis, "instrument" | "progression"> {
  const named = namedDoshas(scored);
  const sections: AnalysisSection[] = [];

  if (scored.classification.key === "dvandva") {
    const pairKey = ["VAT_PIT", "PIT_KAP", "VAT_KAP"].find((k) => named.every((d) => k.includes(d)))!;
    const pair = doshaGuide.dual_and_balanced_constitutions[pairKey as "VAT_PIT"];
    sections.push({ title: pair.label, paragraphs: [pair.description] });
  } else if (scored.classification.key === "sama") {
    sections.push({ title: "Sama", paragraphs: [doshaGuide.dual_and_balanced_constitutions.SAMA.description] });
  }
  for (const d of named) sections.push(doshaSection(d));
  if (named.length > 0) sections.push(practiceSection(named[0], `Practice for ${doshaGuide.doshas[named[0]].label}`));
  sections.push({
    title: "The three doshas",
    items: byShare(scored).map((d) => `${dimensionName("prakriti", d)}: ${Math.round(scored.shares![d])}%`),
  });

  const caveats = qualityCaveats(scored);
  if (scored.quality.flags.includes("near_boundary") && scored.classification.runnerUp) {
    caveats.unshift(
      `This result is close to a boundary. Read the ${scored.classification.runnerUp} description as well, as the workbook suggests.`,
    );
  }

  return {
    headline: scored.classification.label!,
    summary: classificationDescription("prakriti", scored) ?? "",
    sections,
    caveats: [...caveats, ...doshaGuide.know_the_limits.points],
  };
}

function analyseVikriti(
  scored: ScoredResult,
  prakritiLatest: ScoredResult | null,
): Omit<Analysis, "instrument" | "progression"> {
  const elevated = byShare(scored).filter((d) => levelOf("vikriti", scored, d) === "high") as Dosha[];
  const sections: AnalysisSection[] = [
    {
      title: "Ticks by column",
      items: (["VAT", "PIT", "KAP"] as const).map((d) => `${dimensionName("vikriti", d)}: ${scored.raw[d]} of 6`),
    },
  ];

  const relation = vikritiVsPrakriti(scored, prakritiLatest);
  if (relation) sections.push({ title: "Compared with your Prakriti", paragraphs: [relation] });
  else if (!prakritiLatest && elevated.length)
    sections.push({
      title: "Compared with your Prakriti",
      paragraphs: ["Take the Prakriti test to see whether this is your nature increasing or a pull away from it."],
    });

  for (const d of elevated) {
    const g: DoshaGuideEntry = doshaGuide.doshas[d];
    sections.push({ title: `What raises ${g.label}`, paragraphs: [g.increased_by] });
    sections.push(practiceSection(d, `To settle ${g.label}`));
  }

  const caveats: string[] = [];
  if (scored.quality.flags.includes("referral")) caveats.push(FLAG_TEXT.referral);
  return {
    headline: scored.classification.label!,
    summary: classificationDescription("vikriti", scored) ?? "",
    sections,
    caveats: [...caveats, ...doshaGuide.know_the_limits.points],
  };
}

// ---------- entry point ----------

export function analyse(history: InstrumentHistory, prakritiLatest: ScoredResult | null = null): Analysis | null {
  const scored = history.latest.scored;
  if (!scored) return null;
  const key = history.key;
  const body =
    key === "bigfive"
      ? analyseBigFive(scored)
      : key === "ecrr"
        ? analyseEcrr(scored)
        : key === "guna"
          ? analyseGuna(scored)
          : key === "prakriti"
            ? analysePrakriti(scored)
            : analyseVikriti(scored, prakritiLatest);
  return { instrument: key, ...body, progression: progressionLine(history) };
}
