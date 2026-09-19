"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { scoreBigFive } from "@/lib/scoring";
import bigfive from "@/lib/bigfive.json";

export default function BigFivePage() {
  const router = useRouter();
  const supabase = createClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, [router, supabase]);

  const allAnswered = bigfive.items.every((item) => answers[item.id] != null);

  async function submit() {
    setStatus("saving");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { scores, labels } = scoreBigFive(answers);

    const { error } = await supabase.from("bigfive_results").upsert({
      user_id: user.id,
      answers,
      scores,
      labels,
    });

    if (error) {
      console.error(error);
      setStatus("error");
      return;
    }

    router.push("/results");
  }

  return (
    <main className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-xl font-semibold">Big Five (IPIP-50)</h1>
      <div className="flex flex-col gap-6">
        {bigfive.items.map((item) => (
          <fieldset key={item.id} className="flex flex-col gap-2">
            <legend className="text-sm">{item.text}</legend>
            <div className="flex gap-4">
              {bigfive.response_scale.values.map((v) => (
                <label key={v} className="flex items-center gap-1 text-sm">
                  <input
                    type="radio"
                    name={item.id}
                    value={v}
                    checked={answers[item.id] === v}
                    onChange={() => setAnswers((a) => ({ ...a, [item.id]: v }))}
                  />
                  {v}
                </label>
              ))}
            </div>
          </fieldset>
        ))}
      </div>

      <button
        disabled={!allAnswered || status === "saving"}
        onClick={submit}
        className="mt-8 rounded bg-black px-4 py-2 text-white disabled:opacity-40"
      >
        {status === "saving" ? "Saving…" : "Submit"}
      </button>
      {status === "error" && <p className="mt-2 text-red-600">Save failed. Try again.</p>}
    </main>
  );
}
