"use client";

import ScaleSlider from "./ScaleSlider";

interface ScaleQuestionCardProps {
  tag: string;
  index: number;
  total: number;
  question: string;
  labelLow: string;
  labelHigh: string;
  steps: number;
  value: number | null;
  onChange: (value: number) => void;
  onNext: () => void;
  isLast: boolean;
}

export default function ScaleQuestionCard({
  tag,
  index,
  total,
  question,
  labelLow,
  labelHigh,
  steps,
  value,
  onChange,
  onNext,
  isLast,
}: ScaleQuestionCardProps) {
  const ready = value != null;

  return (
    <div className="vn-card" style={{ maxWidth: "28rem", margin: "0 auto" }}>
      <div className="mb-4 flex items-center justify-between">
        <span
          className="text-xs uppercase"
          style={{ letterSpacing: "0.08em", color: "var(--green-text)" }}
        >
          {tag}
        </span>
        <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
          {index + 1} / {total}
        </span>
      </div>

      {/* Fixed height regardless of question length (longest item is ~96 chars,
          wraps to at most 3 lines at this width), so the card doesn't resize
          and the slider/button don't jump between questions. */}
      <p
        className="serif-italic mb-6 text-lg leading-relaxed"
        style={{ color: "var(--ink)", minHeight: "5.6rem" }}
      >
        {question}
      </p>

      <ScaleSlider steps={steps} value={value} onChange={onChange} labelLow={labelLow} labelHigh={labelHigh} />

      <div className="mb-6 flex justify-between text-xs uppercase" style={{ letterSpacing: "0.06em" }}>
        <span style={{ color: "var(--ink-faint)", width: "6rem" }}>{labelLow}</span>
        <span style={{ color: "var(--ink-faint)", width: "6rem", textAlign: "right" }}>{labelHigh}</span>
      </div>

      <div className="flex justify-end">
        <button
          disabled={!ready}
          onClick={onNext}
          className="rounded-full px-6 py-2 text-xs uppercase"
          style={{
            letterSpacing: "0.06em",
            color: "var(--green-text)",
            background: "var(--gold-dim)",
            border: "1px solid var(--gold)",
            opacity: ready ? 1 : 0.35,
            cursor: ready ? "pointer" : "default",
          }}
        >
          {isLast ? "Finish" : "Next one"}
        </button>
      </div>
    </div>
  );
}
