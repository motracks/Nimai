"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { submitAssessment } from "@/app/actions/assessments";
import type { InstrumentKey } from "@/lib/instruments";
import ScaleQuestionCard from "@/components/ScaleQuestionCard";

interface LikertInstrument {
  items: { id: string; text: string }[];
  response_scale: { labels: string[]; values: number[] };
}

interface Props {
  instrument: InstrumentKey;
  data: LikertInstrument;
  eyebrow: string;
  heading: string;
  tag: string;
}

// Drafts live in the browser only, so a reload mid-questionnaire doesn't lose
// progress. Cleared once the server has stored the result.
const draftKey = (instrument: string) => `nimai:draft:${instrument}`;

function readDraft(instrument: string): Record<string, number> {
  try {
    const raw = localStorage.getItem(draftKey(instrument));
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export default function LikertAssessment({ instrument, data, eyebrow, heading, tag }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [current, setCurrent] = useState(0);
  const [status, setStatus] = useState<"idle" | "saving" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const steps = data.response_scale.values.length;
  const labelLow = data.response_scale.labels[0];
  const labelHigh = data.response_scale.labels[data.response_scale.labels.length - 1];
  const total = data.items.length;

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data: auth }) => {
        if (!auth.user) {
          router.push("/login");
          return;
        }
        // Restore after mount (localStorage isn't available during SSR); resume
        // at the first unanswered item.
        const draft = readDraft(instrument);
        const firstOpen = data.items.findIndex((i) => draft[i.id] == null);
        setAnswers(draft);
        setCurrent(firstOpen === -1 ? total - 1 : firstOpen);
      });
  }, [router, instrument, data.items, total]);

  function answer(id: string, value: number) {
    setAnswers((a) => {
      const next = { ...a, [id]: value };
      try {
        localStorage.setItem(draftKey(instrument), JSON.stringify(next));
      } catch {
        // storage unavailable (private mode); the draft just isn't kept
      }
      return next;
    });
  }

  async function submit() {
    setStatus("saving");
    const res = await submitAssessment(instrument, answers);
    if (!res.ok) {
      setErrorMsg(res.error);
      setStatus("error");
      return;
    }
    try {
      localStorage.removeItem(draftKey(instrument));
    } catch {}
    router.push("/results");
  }

  const item = data.items[current];
  const sliderValue = answers[item.id] != null ? answers[item.id] - 1 : null;

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">{eyebrow}</p>
      <h1 className="vn-heading mb-8">{heading}</h1>

      <ScaleQuestionCard
        tag={tag}
        index={current}
        total={total}
        question={item.text}
        labelLow={labelLow}
        labelHigh={labelHigh}
        steps={steps}
        value={sliderValue}
        onChange={(v) => answer(item.id, v + 1)}
        onNext={() => (current < total - 1 ? setCurrent((c) => c + 1) : submit())}
        isLast={current === total - 1}
      />

      {current > 0 && status !== "saving" && (
        <p className="mt-4 text-center">
          <button
            onClick={() => setCurrent((c) => c - 1)}
            className="text-xs uppercase"
            style={{ letterSpacing: "0.06em", color: "var(--ink-dim)" }}
          >
            Back
          </button>
        </p>
      )}
      {status === "saving" && (
        <p className="mt-4 text-center text-sm" style={{ color: "var(--ink-dim)" }}>
          Saving…
        </p>
      )}
      {status === "error" && <p className="vn-error mt-4 text-center">{errorMsg || "Save failed. Try again."}</p>}
    </main>
  );
}
