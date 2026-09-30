import Link from "next/link";
import { Cited } from "@/components/AnalysisView";
import type { Need } from "@/lib/needs";

const CONF_LABEL = { high: "Clear signal", medium: "Likely", low: "Worth a look" } as const;

export default function NeedsCard({ items }: { items: Need[] }) {
  if (items.length === 0) return null;
  return (
    <section className="vn-card mb-4" aria-labelledby="needs-heading">
      <h2 id="needs-heading" className="text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
        What needs attention now
      </h2>
      <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>
        Your latest results read together: how you are now first, then temperament, then nature.
      </p>
      <ol className="mt-3 flex flex-col gap-4">
        {items.map((n) => (
          <li key={n.title}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <h3 className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                {n.title}
              </h3>
              <span className="text-xs" style={{ color: "var(--ink-dim)" }}>
                {n.layer} · {CONF_LABEL[n.confidence]}
              </span>
            </div>
            <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
              <Cited text={n.detail} />
            </p>
            <p className="mt-1 text-xs" style={{ color: "var(--ink-dim)" }}>
              {n.why}{" "}
              <Link href={n.href} className="vn-link">
                More
              </Link>
            </p>
          </li>
        ))}
      </ol>
    </section>
  );
}
