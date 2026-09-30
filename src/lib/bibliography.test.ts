import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { KIND_ORDER, KNOWLEDGE_FILES, SOURCES, citation } from "./bibliography";

describe("bibliography", () => {
  it("lists every knowledge file, and every file's source is in the registry", () => {
    const dir = path.join(import.meta.dirname, "knowledge");
    const files = readdirSync(dir).filter((f) => f.endsWith(".json") && f !== "sources.json");
    expect(KNOWLEDGE_FILES).toHaveLength(files.length);
    const ids = SOURCES.map((s) => s.id);
    for (const f of KNOWLEDGE_FILES) expect(ids).toContain(f.source.id);
  });

  it("every entry says which version was used, what was read, and where its details came from", () => {
    const kinds = KIND_ORDER.map((k) => k.kind);
    for (const s of SOURCES) {
      expect(kinds, s.id).toContain(s.kind);
      for (const field of ["author", "title", "format", "read", "verified"] as const) {
        expect(s[field], `${s.id}.${field}`).toBeTruthy();
      }
      expect(s.used_for.length, s.id).toBeGreaterThan(0);
      // Published books carry a year and publisher; the gaps are only allowed when
      // 'verified' explains them.
      if (s.kind !== "workbook" && (!s.year || !s.publisher)) expect(s.verified, s.id).toMatch(/not on|check/);
    }
  });

  it("formats a long-form citation", () => {
    const gita = SOURCES.find((s) => s.id === "easwaran2007")!;
    expect(citation(gita)).toBe(
      "Eknath Easwaran (trans.) (2007). The Bhagavad Gita (2nd ed.). Nilgiri Press, Tomales CA. ISBN 978-1-58638-019-9.",
    );
  });
});
