import bigfive from "./bigfive.json";
import bigfiveMapping from "./bigfive_mapping.json";

type Dimension = "EXT" | "AGR" | "CON" | "NEU" | "OPN";

export function scoreBigFive(answers: Record<string, number>) {
  const sums: Record<Dimension, number> = { EXT: 0, AGR: 0, CON: 0, NEU: 0, OPN: 0 };
  const counts: Record<Dimension, number> = { EXT: 0, AGR: 0, CON: 0, NEU: 0, OPN: 0 };

  for (const item of bigfive.items) {
    const raw = answers[item.id];
    if (raw == null) continue;
    const value = item.reverse ? 6 - raw : raw;
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
