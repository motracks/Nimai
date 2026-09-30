import type { Metadata } from "next";
import { INSTRUMENT_SOURCES, KIND_ORDER, citation, claimCount, sourcesByKind } from "@/lib/bibliography";

export const metadata: Metadata = { title: "Sources · Nimai" };

export default function SourcesPage() {
  return (
    <main className="vn-page" style={{ maxWidth: "48rem" }}>
      <p className="vn-eyebrow">Sources</p>
      <h1 className="vn-heading mb-4">Bibliography</h1>
      <p className="vn-body mb-3">
        Every book the interpretations draw on, and the exact edition we worked from. Nothing is quoted: the content is
        written in our own words and cites the chapter or page it comes from, so you can look it up.
      </p>
      <p className="vn-body mb-10" style={{ color: "var(--ink-dim)" }}>
        &ldquo;Details from&rdquo; says where the edition details were read. Where they aren&rsquo;t on the copy we
        have, the entry says so instead of guessing.
      </p>

      {KIND_ORDER.map(({ kind, heading, blurb }) => {
        const list = sourcesByKind(kind);
        if (list.length === 0) return null;
        return (
          <section key={kind} className="mb-10">
            <h2 className="serif mb-1 text-2xl" style={{ color: "var(--ink)" }}>
              {heading}
            </h2>
            <p className="mb-4 text-sm" style={{ color: "var(--ink-dim)" }}>
              {blurb}
            </p>
            <ol className="flex flex-col gap-4">
              {list.map((s) => {
                const claims = claimCount(s.id);
                return (
                  <li key={s.id} id={s.id} className="vn-card scroll-mt-6">
                    <p className="vn-body" style={{ color: "var(--ink)" }}>
                      {citation(s)}
                    </p>
                    <dl className="mt-3 grid gap-x-4 gap-y-1 text-sm sm:grid-cols-[9rem_1fr]" style={{ color: "var(--ink-mid)" }}>
                      <dt style={{ color: "var(--ink-dim)" }}>Version used</dt>
                      <dd>{s.format}</dd>
                      <dt style={{ color: "var(--ink-dim)" }}>What we read</dt>
                      <dd>{s.read}</dd>
                      <dt style={{ color: "var(--ink-dim)" }}>Used for</dt>
                      <dd>{s.used_for.join("; ")}</dd>
                      {claims > 0 && (
                        <>
                          <dt style={{ color: "var(--ink-dim)" }}>Cited points</dt>
                          <dd>{claims}</dd>
                        </>
                      )}
                      <dt style={{ color: "var(--ink-dim)" }}>Details from</dt>
                      <dd>{s.verified}</dd>
                    </dl>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}

      <section className="mb-10">
        <h2 className="serif mb-1 text-2xl" style={{ color: "var(--ink)" }}>
          Questionnaires and calculation
        </h2>
        <p className="mb-4 text-sm" style={{ color: "var(--ink-dim)" }}>
          Where the tests themselves, and the chart calculation, come from.
        </p>
        <ul className="flex flex-col gap-4">
          {INSTRUMENT_SOURCES.map((i) => (
            <li key={i.name} className="vn-card">
              <p className="vn-body" style={{ color: "var(--ink)" }}>
                {i.name}
              </p>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-mid)" }}>
                {i.citation}
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                Used for: {i.used_for}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
