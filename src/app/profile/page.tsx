import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { INSTRUMENTS } from "@/lib/instruments";
import { buildHistories, type ResultRow } from "@/lib/results";
import { buildProfile, type Finding, type VedicChart } from "@/lib/profile";
import { SectionView } from "@/components/AnalysisView";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // RLS scopes both queries to the signed-in user.
  const [results, vedic] = await Promise.all([
    supabase
      .from("assessment_results")
      .select("id, instrument, instrument_version, scoring_version, answers, result, source, completed_at")
      .order("completed_at", { ascending: true }),
    supabase.from("vedic_charts").select("chart").maybeSingle(),
  ]);

  const histories = buildHistories((results.data ?? []) as ResultRow[]);
  const profile = buildProfile(histories, (vedic.data?.chart as VedicChart | undefined) ?? null);

  return (
    <main className="vn-page">
      <p className="vn-eyebrow">Verdic Nimai</p>
      <h1 className="vn-heading mb-2">Your profile</h1>
      <p className="mb-8 text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
        Each framework describes you in its own terms. Here they are read side by side: where they meet, where
        they differ, and how things have moved since you started.
      </p>

      {results.error && <p className="vn-error mb-4">{results.error.message}</p>}

      {profile.taken.length === 0 ? (
        <section className="vn-card mb-4">
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Take at least one test to start your profile.{" "}
            <Link href="/" style={{ color: "var(--green-text)" }}>
              Choose a test
            </Link>
          </p>
        </section>
      ) : (
        <>
          {profile.sections.map((s) => (
            <section key={s.title} className="vn-card mb-4">
              <SectionView section={s} />
            </section>
          ))}

          {(profile.resonances.length > 0 || profile.differences.length > 0) && (
            <section className="vn-card mb-4 flex flex-col gap-4">
              <Findings title="Where the frameworks meet" findings={profile.resonances} />
              <Findings title="Where they differ" findings={profile.differences} />
            </section>
          )}

          {profile.progression.length > 0 && (
            <section className="vn-card mb-4">
              <SectionView
                section={{
                  title: "Since your baseline",
                  items: profile.progression.map((p) => `${INSTRUMENTS[p.key].label}: ${p.line}`),
                }}
              />
            </section>
          )}

          {profile.practice && (
            <section className="vn-card mb-4">
              <SectionView section={profile.practice} />
            </section>
          )}

          {(profile.missing.length > 0 || profile.stale.length > 0) && (
            <section className="vn-card mb-4 flex flex-col gap-2">
              {profile.missing.length > 0 && (
                <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  Not taken yet:{" "}
                  {profile.missing.map((k, i) => (
                    <span key={k}>
                      {i > 0 && ", "}
                      <Link href={INSTRUMENTS[k].testHref} style={{ color: "var(--green-text)" }}>
                        {INSTRUMENTS[k].label}
                      </Link>
                    </span>
                  ))}
                  . Each one adds to how the frameworks can be read together.
                </p>
              )}
              {profile.stale.map((s) => (
                <p key={s.key} className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  Your {INSTRUMENTS[s.key].label} result is from {formatDate(s.completedAt)}.{" "}
                  <Link href={INSTRUMENTS[s.key].testHref} style={{ color: "var(--green-text)" }}>
                    Retake it
                  </Link>{" "}
                  to keep this profile current.
                </p>
              ))}
            </section>
          )}

          <p className="text-xs leading-relaxed" style={{ color: "var(--ink-faint)" }}>
            A reflective profile from self-report questionnaires, not a diagnosis. The per-test analyses on{" "}
            <Link href="/results" style={{ color: "var(--green-text)" }}>
              your results
            </Link>{" "}
            go into more detail.
          </p>
        </>
      )}
    </main>
  );
}

function Findings({ title, findings }: { title: string; findings: Finding[] }) {
  if (findings.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
        {title}
      </h3>
      {findings.map((f) => (
        <div key={f.id} className="flex flex-col gap-0.5">
          <p className="text-xs" style={{ color: "var(--ink-dim)" }}>
            {f.between.join(" · ")}
          </p>
          <p className="text-sm leading-relaxed" style={{ color: "var(--ink-mid)" }}>
            {f.text}
          </p>
        </div>
      ))}
    </div>
  );
}
