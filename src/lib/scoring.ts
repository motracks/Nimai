import bigfive from "./bigfive.json";
import bigfiveMapping from "./bigfive_mapping.json";
import ecrr from "./ecrr.json";
import ecrrMapping from "./ecrr_mapping.json";
import guna from "./guna.json";
import prakriti from "./prakriti.json";

const prakritiVikriti = prakriti.vikriti_check;

type Dimension = "EXT" | "AGR" | "CON" | "NEU" | "OPN";

export function scoreBigFive(answers: Record<string, number>) {
  const sums: Record<Dimension, number> = { EXT: 0, AGR: 0, CON: 0, NEU: 0, OPN: 0 };
  const counts: Record<Dimension, number> = { EXT: 0, AGR: 0, CON: 0, NEU: 0, OPN: 0 };

  for (const item of bigfive.items) {
    const raw = answers[item.id];
    if (raw == null) continue;
    const value = item.reverse ? 7 - raw : raw;
    const dim = item.dimension as Dimension;
    sums[dim] += value;
    counts[dim] += 1;
  }

  const scores: Record<Dimension, number> = { EXT: 0, AGR: 0, CON: 0, NEU: 0, OPN: 0 };
  const labels: Record<Dimension, string> = { EXT: "", AGR: "", CON: "", NEU: "", OPN: "" };

  for (const dim of Object.keys(sums) as Dimension[]) {
    const avg = counts[dim] > 0 ? sums[dim] / counts[dim] : 0;
    scores[dim] = Math.round(avg * 100) / 100;

    const bands = bigfiveMapping.dimensions[dim].bands;
    const band = bands.find((b) => avg >= b.range[0] && avg <= b.range[1]);
    labels[dim] = band?.label ?? "Unknown";
  }

  return { scores, labels };
}

type EcrrDimension = "ANX" | "AVD";

export function scoreEcrr(answers: Record<string, number>) {
  const sums: Record<EcrrDimension, number> = { ANX: 0, AVD: 0 };
  const counts: Record<EcrrDimension, number> = { ANX: 0, AVD: 0 };

  for (const item of ecrr.items) {
    const raw = answers[item.id];
    if (raw == null) continue;
    const value = item.reverse ? 7 - raw : raw;
    const dim = item.dimension as EcrrDimension;
    sums[dim] += value;
    counts[dim] += 1;
  }

  const scores: Record<EcrrDimension, number> = { ANX: 0, AVD: 0 };

  for (const dim of Object.keys(sums) as EcrrDimension[]) {
    const avg = counts[dim] > 0 ? sums[dim] / counts[dim] : 0;
    scores[dim] = Math.round(avg * 100) / 100;
  }

  const anxHigh = scores.ANX > 4.0;
  const avdHigh = scores.AVD > 4.0;

  const pattern = ecrrMapping.combined_patterns.find(
    (p) =>
      p.condition === `ANX ${anxHigh ? "high" : "low"}, AVD ${avdHigh ? "high" : "low"}`,
  );

  return { scores, pattern: pattern?.label ?? "Unclassified" };
}

type GunaDimension = "SAT" | "RAJ" | "TAM";

const gunaLabel: Record<GunaDimension, string> = { SAT: "Sattva", RAJ: "Rajas", TAM: "Tamas" };

export function scoreGuna(answers: Record<string, number>) {
  const sums: Record<GunaDimension, number> = { SAT: 0, RAJ: 0, TAM: 0 };
  const counts: Record<GunaDimension, number> = { SAT: 0, RAJ: 0, TAM: 0 };

  for (const item of guna.items) {
    const raw = answers[item.id];
    if (raw == null) continue;
    const dim = item.dimension as GunaDimension;
    sums[dim] += raw;
    counts[dim] += 1;
  }

  const avgs: Record<GunaDimension, number> = { SAT: 0, RAJ: 0, TAM: 0 };
  for (const dim of Object.keys(sums) as GunaDimension[]) {
    avgs[dim] = counts[dim] > 0 ? sums[dim] / counts[dim] : 0;
  }

  const total = avgs.SAT + avgs.RAJ + avgs.TAM;
  const scores: Record<GunaDimension, number> = { SAT: 0, RAJ: 0, TAM: 0 };
  for (const dim of Object.keys(avgs) as GunaDimension[]) {
    scores[dim] = total > 0 ? Math.round((avgs[dim] / total) * 10000) / 100 : 0;
  }

  const sortedDims = (Object.keys(scores) as GunaDimension[]).sort((a, b) => scores[b] - scores[a]);
  const [first, second, third] = sortedDims;

  let pattern: string;
  if (scores[first] >= 45) {
    pattern = `${gunaLabel[first]}-dominant`;
  } else if (
    scores[first] >= 30 &&
    scores[first] <= 45 &&
    scores[second] >= 30 &&
    scores[second] <= 45 &&
    scores[third] < 25
  ) {
    pattern = `${gunaLabel[first]}-${gunaLabel[second]} blend`;
  } else if (
    sortedDims.every((d) => Math.abs(scores[d] - 33.33) <= 10)
  ) {
    pattern = "Balanced / fluid";
  } else {
    pattern = `${gunaLabel[first]}-leaning`;
  }

  return { scores, pattern };
}

type PrakritiDimension = "VAT" | "PIT" | "KAP";

const prakritiLabel: Record<PrakritiDimension, string> = { VAT: "Vata", PIT: "Pitta", KAP: "Kapha" };

const PRAKRITI_MAX_POINTS = 80; // 40 items x 2 points, per prakriti.json scoring_notes

// answers[item.id] is 1 or 2 dimension codes (ticked options). One tick = 2
// points to that dosha; two ticks (allowed sparingly) = 1 point each, matching
// "One ticked box = 2 points. Two ticked boxes on the same question = 1 point each."
export function scorePrakriti(answers: Record<string, PrakritiDimension[]>) {
  const points: Record<PrakritiDimension, number> = { VAT: 0, PIT: 0, KAP: 0 };

  for (const item of prakriti.items) {
    const chosen = answers[item.id];
    if (!chosen || chosen.length === 0) continue;
    const weight = chosen.length === 1 ? 2 : 1;
    for (const dim of chosen) {
      points[dim] += weight;
    }
  }

  const scores: Record<PrakritiDimension, number> = { VAT: 0, PIT: 0, KAP: 0 };
  for (const dim of Object.keys(points) as PrakritiDimension[]) {
    scores[dim] = Math.round((points[dim] / PRAKRITI_MAX_POINTS) * 10000) / 100;
  }

  const sortedDims = (Object.keys(scores) as PrakritiDimension[]).sort((a, b) => scores[b] - scores[a]);
  const [first, second] = sortedDims;

  // Classification order from the workbook: stop at the first rule that applies.
  let pattern: string;
  if (sortedDims.every((d) => Math.abs(scores[d] - scores[first]) <= 10)) {
    pattern = "Sama (Tridoshaja)";
  } else if (scores[first] - scores[second] >= 15) {
    pattern = `${prakritiLabel[first]}-dominant`;
  } else {
    pattern = `${prakritiLabel[first]}-${prakritiLabel[second]} (dual)`;
  }

  return { scores, pattern };
}

type VikritiDimension = "VAT" | "PIT" | "KAP";

// Vikriti is a separate 6-item current-state check (prakriti.vikriti_check),
// scored independently — count of ticks per column, out of 6 each. Never
// merged into scorePrakriti's percentages.
export function scoreVikriti(answers: Record<string, VikritiDimension[]>) {
  const ticks: Record<VikritiDimension, number> = { VAT: 0, PIT: 0, KAP: 0 };

  for (const item of prakritiVikriti.items) {
    const chosen = answers[item.id];
    if (!chosen) continue;
    for (const dim of chosen) {
      ticks[dim as VikritiDimension] += 1;
    }
  }

  return { scores: ticks };
}
