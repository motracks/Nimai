"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { scorePrakriti } from "@/lib/scoring";
import prakriti from "@/lib/prakriti.json";

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type Dimension = "VAT" | "PIT" | "KAP";

export default function PrakritiPage() {
  const router = useRouter();
  const supabase = createClient();
  // Each item maps to 1-2 ticked dimensions, matching the workbook's "tick one,
  // or two sparingly if equally true" rule (prakriti.json response_scale).
  const [answers, setAnswers] = useState<Record<string, Dimension[]>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  // Shuffle each item's option order once per page load so dosha isn't
  // inferable from a consistent position across items. Done client-side only
  // (not in useMemo, which also runs during SSR) so the server-rendered order
  // and the client's random shuffle never disagree and trigger a hydration
  // mismatch — items render in their natural JSON order until this runs.
  const [shuffledItems, setShuffledItems] = useState(prakriti.items);

  useEffect(() => {
    setShuffledItems(prakriti.items.map((item) => ({ ...item, options: shuffled(item.options) })));
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, [router, supabase]);

  const allAnswered = prakriti.items.every((item) => (answers[item.id]?.length ?? 0) > 0);

  function toggleOption(itemId: string, dim: Dimension) {
    setAnswers((a) => {
      const current = a[itemId] ?? [];
      if (current.includes(dim)) {
        return { ...a, [itemId]: current.filter((d) => d !== dim) };
      }
      // Cap at 2 ticks per item — "if two options fit you equally, tick both.
      // Do this sparingly" (prakriti.json response_scale), not tick-everything.
      if (current.length >= 2) return a;
      return { ...a, [itemId]: [...current, dim] };
    });
  }

  async function submit() {
    setStatus("saving");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { scores, pattern } = scorePrakriti(answers);

    const { error } = await supabase.from("prakriti_results").upsert({
      user_id: user.id,
      answers,
      scores,
      pattern,
    });

    if (error) {
      console.error(error);
      setStatus("error");
      return;
    }

    router.push("/results");
  }

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">Prakriti</p>
      <h1 className="vn-heading">Vata · Pitta · Kapha</h1>
      <div className="flex flex-col gap-6">
        {shuffledItems.map((item) => (
          <fieldset key={item.id} className="flex flex-col gap-2">
            <legend className="text-sm font-medium" style={{ color: "var(--ink)" }}>
              {item.text}
            </legend>
            <div className="flex flex-col gap-1">
              {item.options.map((opt) => (
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

      <button disabled={!allAnswered || status === "saving"} onClick={submit} className="vn-btn mt-8">
        {status === "saving" ? "Saving…" : "Submit"}
      </button>
      {status === "error" && <p className="vn-error mt-2">Save failed. Try again.</p>}
    </main>
  );
}
