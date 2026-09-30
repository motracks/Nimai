import { describe, expect, it } from "vitest";
import { retakeCheck } from "./instruments";

const now = Date.parse("2026-10-15T12:00:00Z");
const daysAgo = (d: number) => new Date(now - d * 24 * 60 * 60 * 1000).toISOString();

describe("retake rule", () => {
  it("allows a first attempt", () => {
    expect(retakeCheck("bigfive", null, now)).toEqual({ status: "ok" });
  });

  it("blocks traits and the constitution inside 14 days", () => {
    for (const key of ["bigfive", "ecrr", "prakriti"] as const) {
      const r = retakeCheck(key, daysAgo(3), now);
      expect(r.status, key).toBe("blocked");
      if (r.status !== "ok") {
        expect(r.daysSince).toBe(3);
        expect(r.availableOn.toISOString()).toBe(new Date(now + 11 * 24 * 60 * 60 * 1000).toISOString());
      }
    }
  });

  it("only warns for states inside 14 days", () => {
    expect(retakeCheck("guna", daysAgo(2), now).status).toBe("warn");
    expect(retakeCheck("vikriti", daysAgo(13), now).status).toBe("warn");
  });

  it("opens again at exactly 14 days", () => {
    expect(retakeCheck("bigfive", daysAgo(14), now)).toEqual({ status: "ok" });
    expect(retakeCheck("vikriti", daysAgo(14), now)).toEqual({ status: "ok" });
  });
});
