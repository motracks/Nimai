import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ResultsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Deliberately relying on RLS here, not an explicit .eq("user_id", user.id) —
  // this is the point of the spike: confirm the policy alone is what scopes the row.
  const [bigfive, ecrr, guna, prakriti, vedic] = await Promise.all([
    supabase.from("bigfive_results").select("*").maybeSingle(),
    supabase.from("ecrr_results").select("*").maybeSingle(),
    supabase.from("guna_results").select("*").maybeSingle(),
    supabase.from("prakriti_results").select("*").maybeSingle(),
    supabase.from("vedic_charts").select("*").maybeSingle(),
  ]);

  return (
    <main className="vn-page">
      <p className="vn-eyebrow">Verdic Nimai</p>
      <h1 className="vn-heading mb-8">Your results</h1>

      <section className="vn-card mb-4">
        <h2 className="serif mb-3 text-lg" style={{ color: "var(--ink)" }}>
          Personality
        </h2>
        {bigfive.error && <p className="vn-error">{bigfive.error.message}</p>}
        {!bigfive.error && !bigfive.data && (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Not taken yet.
          </p>
        )}
        {bigfive.data && (
          <dl className="flex flex-col gap-1">
            {Object.entries(bigfive.data.labels as Record<string, string>).map(([dim, label]) => (
              <div
                key={dim}
                className="flex justify-between py-1"
                style={{ borderBottom: "1px solid var(--sand-dim)" }}
              >
                <dt className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  {dim}
                </dt>
                <dd style={{ color: "var(--ink)" }}>{label}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <section className="vn-card mb-4">
        <h2 className="serif mb-3 text-lg" style={{ color: "var(--ink)" }}>
          Attachment
        </h2>
        {ecrr.error && <p className="vn-error">{ecrr.error.message}</p>}
        {!ecrr.error && !ecrr.data && (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Not taken yet.
          </p>
        )}
        {ecrr.data && <p style={{ color: "var(--ink)" }}>{ecrr.data.pattern}</p>}
      </section>

      <section className="vn-card mb-4">
        <h2 className="serif mb-3 text-lg" style={{ color: "var(--ink)" }}>
          Guna
        </h2>
        {guna.error && <p className="vn-error">{guna.error.message}</p>}
        {!guna.error && !guna.data && (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Not taken yet.
          </p>
        )}
        {guna.data && <p style={{ color: "var(--ink)" }}>{guna.data.pattern}</p>}
      </section>

      <section className="vn-card mb-4">
        <h2 className="serif mb-3 text-lg" style={{ color: "var(--ink)" }}>
          Prakriti
        </h2>
        {prakriti.error && <p className="vn-error">{prakriti.error.message}</p>}
        {!prakriti.error && !prakriti.data && (
          <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
            Not taken yet.
          </p>
        )}
        {prakriti.data && <p style={{ color: "var(--ink)" }}>{prakriti.data.pattern}</p>}
      </section>

      <section className="vn-cosmic">
        <h2 className="serif mb-3 text-lg" style={{ color: "var(--gold-bright)" }}>
          Vedic chart
        </h2>
        {vedic.error && <p className="vn-error">{vedic.error.message}</p>}
        {!vedic.error && !vedic.data && (
          <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
            Not taken yet.
          </p>
        )}
        {vedic.data && (
          <div className="flex flex-col gap-3">
            <p style={{ color: "var(--night-text)" }}>
              Moon in{" "}
              <span className="serif-italic" style={{ color: "var(--gold-bright)" }}>
                {vedic.data.chart.moon_nakshatra.name}
              </span>
              , pada {vedic.data.chart.moon_nakshatra.pada}
            </p>
            {vedic.data.ascendant_reliable ? (
              <p style={{ color: "var(--night-text)" }}>
                Ascendant:{" "}
                <span className="serif-italic" style={{ color: "var(--gold-bright)" }}>
                  {vedic.data.chart.ascendant.sign}
                </span>
              </p>
            ) : (
              <p className="text-sm" style={{ color: "var(--night-text-dim)" }}>
                Birth time unknown — ascendant and houses omitted. Using Chandra Lagna (
                {vedic.data.chart.chandra_lagna.sign}) instead.
              </p>
            )}
            <dl className="flex flex-col gap-1">
              {(vedic.data.chart.planets as { name: string; sign: string }[]).map((p) => (
                <div
                  key={p.name}
                  className="flex justify-between py-1"
                  style={{ borderBottom: "1px solid rgba(201, 166, 104, 0.15)" }}
                >
                  <dt className="text-sm" style={{ color: "var(--night-text-dim)" }}>
                    {p.name}
                  </dt>
                  <dd style={{ color: "var(--night-text)" }}>{p.sign}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}
      </section>
    </main>
  );
}
