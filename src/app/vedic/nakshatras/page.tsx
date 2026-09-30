import type { Metadata } from "next";
import Link from "next/link";
import { NAKSHATRAS } from "@/lib/nakshatras";

export const metadata: Metadata = { title: "The 27 nakshatras · Nimai" };

export default function NakshatrasPage() {
  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">Vedic chart</p>
      <h1 className="vn-heading mb-3">The 27 nakshatras</h1>
      <p className="vn-body mb-8">
        The lunar mansions: the Moon&rsquo;s path split into 27 parts of 13°20&prime;. In Vedic astrology the
        nakshatra the Moon sat in at birth says most about the mind and emotional nature. Based on Harness,{" "}
        <Link href="/sources#harness1999" className="vn-link">
          The Nakshatras
        </Link>{" "}
        (1999).
      </p>
      <ol className="flex flex-col">
        {NAKSHATRAS.map((n) => (
          <li key={n.slug} style={{ borderBottom: "1px solid var(--ink-faint)" }}>
            <Link href={`/vedic/nakshatras/${n.slug}`} className="flex items-baseline justify-between gap-3 py-2 no-underline">
              <span style={{ color: "var(--ink)" }}>
                <span className="mr-2 tabular-nums text-xs" style={{ color: "var(--ink-dim)" }}>
                  {n.index}
                </span>
                {n.name}
              </span>
              <span className="text-right text-xs" style={{ color: "var(--ink-dim)" }}>
                {n.range}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </main>
  );
}
