"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitAssessment } from "@/app/actions/assessments";
import type { InstrumentKey } from "@/lib/instruments";

type Dimension = "VAT" | "PIT" | "KAP";

interface TickItem {
  id: string;
  text?: string;
  options: { text: string; dimension: string }[];
}

interface Props {
  instrument: InstrumentKey;
  items: TickItem[];
  minTicks: number; // per item
  maxTicks: number; // per item
  eyebrow: string;
  heading: string;
  intro?: string;
}

// Fixed per-item option order derived from the item id: the same on server and
// client (no hydration mismatch, no effect needed), but different across items,
// so the dosha can't be inferred from a consistent position.
function seededOrder<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rand = () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function TickAssessment({ instrument, items, minTicks, maxTicks, eyebrow, heading, intro }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, Dimension[]>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (!data.user) router.push("/login");
      });
  }, [router]);

  const complete = items.every((item) => (answers[item.id]?.length ?? 0) >= minTicks);

  function toggleOption(itemId: string, dim: Dimension) {
    setAnswers((a) => {
      const current = a[itemId] ?? [];
      if (current.includes(dim)) return { ...a, [itemId]: current.filter((d) => d !== dim) };
      if (current.length >= maxTicks) return a;
      return { ...a, [itemId]: [...current, dim] };
    });
  }

  async function submit() {
    setStatus("saving");
    try {
      const res = await submitAssessment(instrument, answers);
      if (!res.ok) {
        setErrorMsg(res.error);
        setStatus("error");
        return;
      }
    } catch {
      // submitAssessment shouldn't throw, but if it ever does (a network drop,
      // a server action failing to even respond), show an error instead of
      // leaving the button stuck on "Saving…" forever.
      setErrorMsg("Save failed. Try again.");
      setStatus("error");
      return;
    }
    router.push(`/#result-${instrument}`);
  }

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">{eyebrow}</p>
      <h1 className="vn-heading">{heading}</h1>
      {intro && (
        <p className="mb-6 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
          {intro}
        </p>
      )}
      <div className="flex flex-col gap-6">
        {items.map((item, idx) => (
          <fieldset key={item.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {item.text ?? `${idx + 1}.`}
            </legend>
            <div className="flex flex-col gap-1">
              {seededOrder(item.options, item.id).map((opt) => (
                <label
                  key={opt.text}
                  className="flex items-center gap-2 text-sm"
                  style={{ color: "var(--ink-mid)" }}
                >
                  <input
                    type="checkbox"
                    name={item.id}
                    checked={(answers[item.id] ?? []).includes(opt.dimension as Dimension)}
                    onChange={() => toggleOption(item.id, opt.dimension as Dimension)}
                  />
                  {opt.text}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <button disabled={!complete || status === "saving"} onClick={submit} className="vn-btn mt-8">
        {status === "saving" ? "Saving…" : "Submit"}
      </button>
      {status === "error" && <p className="vn-error mt-2">{errorMsg || "Save failed. Try again."}</p>}
    </main>
  );
}
