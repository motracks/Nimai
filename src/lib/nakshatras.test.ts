import { describe, expect, it } from "vitest";
import chartNames from "../../supabase/functions/vedic-chart/nakshatras.json";
import { NAKSHATRAS, nakshatraByName, nakshatraBySlug } from "./nakshatras";

describe("nakshatras", () => {
  it("covers every name the chart calculation returns, in order", () => {
    const names = (chartNames as { nakshatras: { index: number; name: string }[] }).nakshatras;
    expect(NAKSHATRAS).toHaveLength(27);
    for (const c of names) expect(nakshatraByName(c.name)?.index).toBe(c.index + 1);
  });

  it("has unique slugs and book facts for every entry", () => {
    expect(new Set(NAKSHATRAS.map((n) => n.slug)).size).toBe(27);
    for (const n of NAKSHATRAS) {
      expect(nakshatraBySlug(n.slug)).toBe(n);
      expect(n.pages).toMatch(/\d/);
      expect(n.traits.length).toBeGreaterThan(0);
    }
    expect(nakshatraBySlug("purva-bhadrapada")?.name).toBe("Purva Bhadrapada");
  });
});
