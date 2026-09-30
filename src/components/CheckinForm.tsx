"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { submitCheckin } from "@/app/actions/checkin";
import { CHECKIN_QUESTIONS, type CheckinAnswer } from "@/lib/checkin";

export default function CheckinForm() {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<string, CheckinAnswer>>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [error, setError] = useState("");
  const complete = CHECKIN_QUESTIONS.every((q) => answers[q.key]);

  async function save() {
    setStatus("saving");
    try {
      const res = await submitCheckin(answers);
      if (!res.ok) {
        setError(res.error);
        setStatus("error");
        return;
      }
    } catch {
      setError("Save failed. Try again.");
      setStatus("error");
      return;
    }
    setStatus("saved");
    setAnswers({});
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {CHECKIN_QUESTIONS.map((q) => (
        <fieldset key={q.key} className="flex min-w-0 flex-col gap-1">
          <legend className="mb-1 text-sm font-medium" style={{ color: "var(--ink)" }}>
            {q.label}
          </legend>
          {q.options.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm" style={{ color: "var(--ink-mid)" }}>
              <input
                type="radio"
                name={q.key}
                checked={answers[q.key] === o.value}
                onChange={() => {
                  setAnswers((a) => ({ ...a, [q.key]: o.value }));
                  if (status === "saved") setStatus("idle");
                }}
              />
              {o.text}
            </label>
          ))}
        </fieldset>
      ))}
      <div className="flex items-center gap-3">
        <button className="vn-btn" disabled={!complete || status === "saving"} onClick={save}>
          {status === "saving" ? "Saving…" : "Save check-in"}
        </button>
        {status === "saved" && (
          <span role="status" className="text-sm" style={{ color: "var(--green-text)" }}>
            Saved.
          </span>
        )}
      </div>
      {status === "error" && <p className="vn-error">{error}</p>}
    </div>
  );
}
