import type { Analysis, AnalysisSection } from "@/lib/analysis";

export function SectionView({ section }: { section: AnalysisSection }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
        {section.title}
      </h3>
      {section.paragraphs?.map((p) => (
        <p key={p} className="text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
          {p}
        </p>
      ))}
      {section.items && (
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
          {section.items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Collapsible per-test analysis, shown under each result.
export default function AnalysisView({ analysis }: { analysis: Analysis }) {
  return (
    <details className="pt-2" style={{ borderTop: "1px solid var(--sand-dim)" }}>
      <summary className="cursor-pointer text-sm" style={{ color: "var(--green-text)" }}>
        Read the analysis
      </summary>
      <div className="mt-3 flex flex-col gap-4">
        <p className="serif-italic" style={{ color: "var(--ink)" }}>
          {analysis.headline}
        </p>
        {analysis.summary && (
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
            {analysis.summary}
          </p>
        )}
        {analysis.sections.map((s) => (
          <SectionView key={s.title} section={s} />
        ))}
        {analysis.progression && (
          <SectionView section={{ title: "Since your baseline", paragraphs: [analysis.progression] }} />
        )}
        {analysis.caveats.length > 0 && (
          <SectionView section={{ title: "Keep in mind", items: analysis.caveats }} />
        )}
      </div>
    </details>
  );
}
