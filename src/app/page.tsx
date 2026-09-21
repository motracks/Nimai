import Link from "next/link";
import { getInstrumentStatuses } from "@/lib/progress";

export default async function Home() {
  const { user, instruments } = await getInstrumentStatuses();
  const completeCount = instruments.filter((i) => i.complete).length;

  return (
    <main className="mx-auto max-w-xl px-8 py-16">
      <p className="serif-italic mb-2 text-sm" style={{ color: "var(--green-text)" }}>
        Verdic Nimai
      </p>
      <h1 className="serif mb-4 text-4xl" style={{ color: "var(--ink)" }}>
        A reflective profile,
        <br />
        drawn from several lenses.
      </h1>
      <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
        Take as many or as few of these as you like. Nothing here is mandatory — the
        synthesis works with whatever you bring to it.
      </p>

      {user && (
        <div className="mb-6 flex items-center gap-3">
          <div
            className="h-1.5 flex-1 overflow-hidden rounded-full"
            style={{ background: "var(--sand-dim)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(completeCount / instruments.length) * 100}%`,
                background: "var(--green-mid)",
              }}
            />
          </div>
          <span className="shrink-0 text-xs" style={{ color: "var(--ink-dim)" }}>
            {completeCount} of {instruments.length} complete
          </span>
        </div>
      )}

      <div className="mb-10 flex flex-col gap-2">
        {instruments.map((i) => (
          <Link
            key={i.key}
            href={user && i.complete ? "/results" : i.testHref}
            className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border px-4 py-3 no-underline transition-colors"
            style={{
              borderColor: i.complete ? "var(--gold)" : "var(--ink-faint)",
              background: i.complete ? "var(--gold-dim)" : "var(--card)",
            }}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span style={{ color: "var(--ink)" }}>{i.label}</span>
              {i.complete && (
                <span className="shrink-0 text-xs" style={{ color: "var(--green-text)" }}>
                  Complete
                </span>
              )}
            </span>
            <span
              className="serif-italic ml-auto text-sm"
              style={{ color: "var(--terracotta)" }}
            >
              {i.sub}
            </span>
          </Link>
        ))}
      </div>

      {user ? (
        completeCount > 0 && (
          <Link
            href="/results"
            className="vn-btn inline-block no-underline"
          >
            View your results
          </Link>
        )
      ) : (
        <Link href="/login" className="vn-btn inline-block no-underline">
          Sign in to begin
        </Link>
      )}
    </main>
  );
}
