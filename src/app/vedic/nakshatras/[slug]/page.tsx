import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NAKSHATRAS, PADA_NOTE, nakshatraBySlug } from "@/lib/nakshatras";

export function generateStaticParams() {
  return NAKSHATRAS.map((n) => ({ slug: n.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const n = nakshatraBySlug((await params).slug);
  return { title: n ? `${n.name} · Nimai` : "Nakshatra · Nimai" };
}

const cite = (pages: string) => `Harness, The Nakshatras, pp. ${pages}`;

export default async function NakshatraPage({ params }: { params: Promise<{ slug: string }> }) {
  const n = nakshatraBySlug((await params).slug);
  if (!n) notFound();
  const prev = NAKSHATRAS[(n.index + 25) % 27];
  const next = NAKSHATRAS[n.index % 27];

  const facts: [string, string | null][] = [
    ["Position", n.range],
    ["Ruling planet", n.ruler],
    ["Deity", n.deity],
    ["Symbol", n.symbol],
    ["Power (shakti)", `${n.shakti.power} (${n.shakti.name})`],
    ["Motivation", n.motivation],
    ["Temperament (gana)", n.gana],
    ["Animal", n.animal],
    ["Gunas (three levels)", n.qualities ? n.qualities.join(", ") : null],
  ];

  return (
    <main className="vn-page" style={{ maxWidth: "40rem" }}>
      <p className="vn-eyebrow">
        <Link href="/vedic/nakshatras" className="vn-link">
          Nakshatras
        </Link>{" "}
        · {n.index} of 27
      </p>
      <h1 className="vn-heading mb-4">{n.name}</h1>
      <p className="vn-body mb-8">{n.tendency}</p>

      <section className="mb-8">
        <h2 className="mb-2 text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
          At a glance
        </h2>
        <dl className="flex flex-col text-sm">
          {facts
            .filter((f): f is [string, string] => f[1] != null)
            .map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 py-1.5" style={{ borderBottom: "1px solid var(--ink-faint)" }}>
                <dt style={{ color: "var(--ink-dim)" }}>{k}</dt>
                <dd className="text-right" style={{ color: "var(--ink)" }}>
                  {v}
                </dd>
              </div>
            ))}
        </dl>
      </section>

      <section className="mb-8">
        <h2 className="mb-2 text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
          With the Moon here
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
          {n.traits.map((t) => (
            <li key={t}>{t[0].toUpperCase() + t.slice(1)}</li>
          ))}
        </ul>
        {n.shadow && (
          <p className="mt-3 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
            <span style={{ color: "var(--ink)" }}>What to watch:</span> {n.shadow}.
          </p>
        )}
      </section>

      <p className="mb-2 text-xs leading-relaxed" style={{ color: "var(--ink-dim)" }}>
        {PADA_NOTE}
      </p>
      <p className="mb-8 text-xs leading-relaxed" style={{ color: "var(--ink-dim)" }}>
        Paraphrased from{" "}
        <Link href="/sources#harness1999" className="vn-link">
          {cite(n.pages)}
        </Link>
        . Tendencies, not predictions: the book&rsquo;s timing, marriage and health predictions are left out on purpose.
      </p>

      <nav className="flex justify-between gap-4 text-sm">
        <Link href={`/vedic/nakshatras/${prev.slug}`} className="vn-link">
          ← {prev.name}
        </Link>
        <Link href={`/vedic/nakshatras/${next.slug}`} className="vn-link">
          {next.name} →
        </Link>
      </nav>
    </main>
  );
}
