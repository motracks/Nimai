"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function VedicPage() {
  const router = useRouter();
  const supabase = createClient();
  const [birthDate, setBirthDate] = useState("");
  const [birthTime, setBirthTime] = useState("");
  const [timeUnknown, setTimeUnknown] = useState(false);
  const [birthPlace, setBirthPlace] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, [router, supabase]);

  function onBirthPlaceChange(value: string) {
    setBirthPlace(value);
    setShowSuggestions(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 4) {
      setSuggestions([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/geocode-suggest?q=${encodeURIComponent(value)}`,
        );
        const data = await res.json();
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      }
    }, 400);
  }

  const canSubmit = birthDate && birthPlace && (timeUnknown || birthTime);

  async function submit() {
    setStatus("saving");
    setErrorMsg("");

    const {
      data: { user, session },
    } = await supabase.auth.getUser().then(async (u) => ({
      data: { user: u.data.user, session: (await supabase.auth.getSession()).data.session },
    }));

    if (!user || !session) {
      router.push("/login");
      return;
    }

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/vedic-chart`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            birth_date: birthDate,
            birth_time: timeUnknown ? null : birthTime,
            birth_place_text: birthPlace,
          }),
        },
      );

      const chart = await res.json();
      if (!res.ok) throw new Error(chart.error ?? "Chart calculation failed");

      const { error: birthDataError } = await supabase.from("birth_data").upsert({
        user_id: user.id,
        birth_date: birthDate,
        birth_time: timeUnknown ? null : birthTime,
        time_unknown: timeUnknown,
        birth_place_text: birthPlace,
        timezone_name: chart.resolved_timezone,
      });
      if (birthDataError) throw birthDataError;

      const { error: chartError } = await supabase.from("vedic_charts").upsert({
        user_id: user.id,
        chart,
        ascendant_reliable: chart.ascendant_reliable,
      });
      if (chartError) throw chartError;

      router.push("/results");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Something went wrong");
      setStatus("error");
    }
  }

  return (
    <main className="vn-page" style={{ maxWidth: "30rem" }}>
      <div className="vn-cosmic flex flex-col gap-6">
        <div>
          <h1
            className="serif mb-2 text-2xl"
            style={{ color: "var(--gold-bright)" }}
          >
            Vedic birth chart
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "var(--night-text-dim)" }}>
            Birth time improves accuracy but isn&apos;t required — without it, we skip the
            ascendant and houses rather than guess.
          </p>
        </div>

        <label className="flex flex-col gap-1.5">
          Birth date
          <input
            type="date"
            required
            value={birthDate}
            onChange={(e) => setBirthDate(e.target.value)}
          />
        </label>

        <label className="flex items-center gap-2" style={{ fontSize: "0.85rem", textTransform: "none" }}>
          <input
            type="checkbox"
            checked={timeUnknown}
            onChange={(e) => setTimeUnknown(e.target.checked)}
          />
          I don&apos;t know my birth time
        </label>

        {!timeUnknown && (
          <label className="flex flex-col gap-1.5">
            Birth time
            <input
              type="time"
              value={birthTime}
              onChange={(e) => setBirthTime(e.target.value)}
            />
          </label>
        )}

        <label className="relative flex flex-col gap-1.5">
          Birth place
          <input
            type="text"
            required
            placeholder="City, Country"
            value={birthPlace}
            onChange={(e) => onBirthPlaceChange(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="vn-suggestions absolute top-full left-0 z-10 mt-1 w-full overflow-hidden rounded-lg">
              {suggestions.map((s) => (
                <li key={s}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setBirthPlace(s);
                      setSuggestions([]);
                      setShowSuggestions(false);
                    }}
                    className="block w-full px-3 py-2 text-left text-sm"
                    style={{ textTransform: "none" }}
                  >
                    {s}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </label>

        <button disabled={!canSubmit || status === "saving"} onClick={submit} className="vn-btn mt-2">
          {status === "saving" ? "Calculating…" : "Calculate chart"}
        </button>
        {status === "error" && <p className="vn-error">{errorMsg}</p>}
      </div>
    </main>
  );
}
