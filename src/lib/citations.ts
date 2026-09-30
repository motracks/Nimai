// Finds the book citations inside content text ("(Nettle, ch.3)",
// "(Mikulincer & Shaver, pp. 19-20; Attached, ch.4)") so they can link to
// their entry on /sources. A bare "(p. 520)" or "(ch.7, Table 4)" continues
// the last book named earlier in the same text.

// Most specific first: "Svoboda, Prakriti" must win over any shorter match.
const PATTERNS: [RegExp, string][] = [
  [/Life, Health and Longevity/, "svobodalife1992"],
  [/Svoboda/, "svoboda"],
  [/Mikulincer & Shaver/, "mikulincershaver2016"],
  [/Handbook of Attachment|Crowell, Fraley/, "cassidyshaver2016"],
  [/Power of Attachment|Poole Heller/, "pooleheller2019"],
  [/Hold Me Tight/, "johnson2008"],
  [/\bAttached\b|Levine & Heller/, "levineheller2010"],
  [/Frawley/, "frawley1996"],
  [/Nettle/, "nettle2007"],
  [/Me, Myself, and Us/, "little2014"],
  [/McCrae & Costa/, "mccraecosta2003"],
  [/Lad, Textbook/, "lad2002"],
  [/Sarira Sthana/, "sharmadash"],
  [/Harness/, "harness1999"],
];

// A reference-only fragment: page, chapter, table or Conversation numbers.
const BARE_REF = /^(pp?\.|ch\.|Table|Conversation)\s?\d/;

export type Segment = { text: string; sourceId?: string };

function sourceFor(part: string): string | undefined {
  return PATTERNS.find(([re]) => re.test(part))?.[1];
}

export function splitCitations(text: string): Segment[] {
  const out: Segment[] = [];
  let last: string | undefined;
  let pos = 0;
  for (const m of text.matchAll(/\(([^()]+)\)/g)) {
    const inner = m[1];
    const parts = inner.split(/;\s*/);
    const ids = parts.map((p) => {
      const id = sourceFor(p) ?? (BARE_REF.test(p.trim()) ? last : undefined);
      if (id) last = id;
      return id;
    });
    if (!ids.some(Boolean)) continue;
    if (m.index! > pos) out.push({ text: text.slice(pos, m.index) });
    out.push({ text: "(" });
    parts.forEach((p, i) => {
      if (i > 0) out.push({ text: "; " });
      out.push(ids[i] ? { text: p, sourceId: ids[i] } : { text: p });
    });
    out.push({ text: ")" });
    pos = m.index! + m[0].length;
  }
  if (pos < text.length) out.push({ text: text.slice(pos) });
  return out;
}
