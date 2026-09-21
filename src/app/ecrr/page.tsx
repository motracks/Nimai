"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { scoreEcrr } from "@/lib/scoring";
import ecrr from "@/lib/ecrr.json";
import ScaleQuestionCard from "@/components/ScaleQuestionCard";

const steps = ecrr.response_scale.values.length;
const labelLow = ecrr.response_scale.labels[0];
const labelHigh = ecrr.response_scale.labels[ecrr.response_scale.labels.length - 1];

export default function EcrrPage() {
  const router = useRouter();
  const supabase = createClient();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push("/login");
    });
  }, [router, supabase]);

  const item = ecrr.items[current];
  const sliderValue = answers[item.id] != null ? answers[item.id] - 1 : null;

  async function submit(finalAnswers: Record<string, number>) {
    setStatus("saving");
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { scores, pattern } = scoreEcrr(finalAnswers);

    const { error } = await supabase.from("ecrr_results").upsert({
      user_id: user.id,
      answers: finalAnswers,
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

  function handleNext() {
    if (current < ecrr.items.length - 1) {
      setCurrent((c) => c + 1);
    } else {
      submit(answers);
    }
  }

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">Attachment</p>
      <h1 className="vn-heading mb-8">ECR-R</h1>

      <ScaleQuestionCard
        tag="ECR-R"
        index={current}
        total={ecrr.items.length}
        question={item.text}
        labelLow={labelLow}
        labelHigh={labelHigh}
        steps={steps}
        value={sliderValue}
        onChange={(v) => setAnswers((a) => ({ ...a, [item.id]: v + 1 }))}
        onNext={handleNext}
        isLast={current === ecrr.items.length - 1}
      />

      {status === "saving" && (
        <p className="mt-4 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
          Saving…
        </p>
      )}
      {status === "error" && <p className="vn-error mt-4 text-center">Save failed. Try again.</p>}
    </main>
  );
}
