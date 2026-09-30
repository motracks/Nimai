import { describe, expect, it } from "vitest";
import { splitCitations } from "./citations";
import { SOURCES } from "./bibliography";
import bigfive from "./analysis/bigfive.json";
import ecrr from "./analysis/ecrr.json";
import guna from "./analysis/guna.json";
import guide from "./prakriti_dosha_guide.json";

const linked = (t: string) => splitCitations(t).filter((s) => s.sourceId);

describe("citation links", () => {
  it("links a named citation, and a bare page reference to the last book named", () => {
    const segs = splitCitations("Reward drives it (Nettle, ch.3). The trade-off is plain (ch.7, Table 4).");
    expect(linked("Reward drives it (Nettle, ch.3). The trade-off is plain (ch.7, Table 4).").map((s) => s.sourceId)).toEqual([
      "nettle2007",
      "nettle2007",
    ]);
    expect(segs.map((s) => s.text).join("")).toBe("Reward drives it (Nettle, ch.3). The trade-off is plain (ch.7, Table 4).");
  });

  it("splits two books in one bracket and picks the more specific Svoboda title", () => {
    expect(linked("x (Mikulincer & Shaver, pp. 19-20; Attached, ch.3)").map((s) => s.sourceId)).toEqual([
      "mikulincershaver2016",
      "levineheller2010",
    ]);
    expect(linked("(Svoboda, Ayurveda: Life, Health and Longevity, ch.4)")[0].sourceId).toBe("svobodalife1992");
    expect(linked("(Svoboda, Prakriti, ch.2)")[0].sourceId).toBe("svoboda");
  });

  it("leaves ordinary brackets alone", () => {
    expect(linked("Your scores (ANX 4.2) are high.")).toEqual([]);
  });

  it("every citation in the shown content resolves to a registered source", () => {
    const ids = new Set(SOURCES.map((s) => s.id));
    const texts = JSON.stringify([bigfive, ecrr, guna.gunas, guide.doshas, guide.keep_in_mind, guide.vikriti_context]).match(/"[^"]*\([^"]*\)[^"]*"/g)!;
    let count = 0;
    for (const t of texts) for (const s of linked(t)) {
      expect(ids).toContain(s.sourceId);
      count++;
    }
    expect(count).toBeGreaterThan(30);
  });
});

describe("Cited component", () => {
  it("renders citations as links to /sources", async () => {
    const { createElement } = await import("react");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const { Cited } = await import("@/components/AnalysisView");
    const html = renderToStaticMarkup(createElement(Cited, { text: "Clarity (Lad, Textbook of Ayurveda, Table 5) and more (p. 2)." }));
    expect(html).toBe(
      'Clarity (<a class="vn-link" href="/sources#lad2002">Lad, Textbook of Ayurveda, Table 5</a>) and more (<a class="vn-link" href="/sources#lad2002">p. 2</a>).',
    );
  });
});
