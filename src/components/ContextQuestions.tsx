"use client";

import { useEffect } from "react";
import { CLIMATES, SEASON_LABEL, hemisphereFromTimeZone, seasonFor, type Climate, type Hemisphere } from "@/lib/context";

export interface ContextAnswer {
  hemisphere: Hemisphere;
  away: boolean;
  climate: Climate | null;
}

export const DEFAULT_CONTEXT: ContextAnswer = { hemisphere: "north", away: false, climate: null };

// Two quick questions so a result can be read against the season and travel.
// Only the hemisphere is sent, never a place.
export default function ContextQuestions({ value, onChange }: { value: ContextAnswer; onChange: (v: ContextAnswer) => void }) {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    onChange({ ...value, hemisphere: hemisphereFromTimeZone(tz) });
    // Detect once on mount; after that the person's own choice wins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const season = SEASON_LABEL[seasonFor(new Date(), value.hemisphere)];
  const other: Hemisphere = value.hemisphere === "north" ? "south" : "north";

  return (
    <fieldset className="vn-card flex min-w-0 flex-col gap-3">
      <legend className="sr-only">Where you are taking this</legend>
      <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
        Where are you taking this?
      </p>
      <div className="flex flex-col gap-1 text-sm" style={{ color: "var(--ink-mid)" }}>
        {[
          { away: false, label: "At home" },
          { away: true, label: "Away from home or travelling" },
        ].map((o) => (
          <label key={o.label} className="flex items-center gap-2">
            <input
              type="radio"
              name="away"
              checked={value.away === o.away}
              onChange={() => onChange({ ...value, away: o.away, climate: o.away ? value.climate : null })}
            />
            {o.label}
          </label>
        ))}
      </div>

      {value.away && (
        <label className="flex flex-col gap-1 text-sm" style={{ color: "var(--ink-mid)" }}>
          Compared with home, the climate there is
          <select
            className="w-full rounded border px-2 py-1"
            style={{ borderColor: "var(--ink-faint)", background: "var(--card)" }}
            value={value.climate ?? ""}
            onChange={(e) => onChange({ ...value, climate: (e.target.value || null) as Climate | null })}
          >
            <option value="">Not sure</option>
            {CLIMATES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      )}

      <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
        Season where you are: {season} ({value.hemisphere}ern hemisphere) ·{" "}
        <button type="button" className="vn-link" onClick={() => onChange({ ...value, hemisphere: other })}>
          I&rsquo;m in the {other}ern hemisphere
        </button>
      </p>
      <p className="text-xs" style={{ color: "var(--ink-faint)" }}>
        Used to compare the same season across years. No location is stored.
      </p>
    </fieldset>
  );
}
