import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CheckinForm from "@/components/CheckinForm";
import { recentCheckins } from "@/lib/checkin-server";
import { summariseCheckin } from "@/lib/checkin";

export const metadata: Metadata = { title: "Check-in · Nimai" };

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

export default async function CheckinPage() {
  const {
    data: { user },
  } = await (await createClient()).auth.getUser();
  if (!user) redirect("/login");

  const { ready, rows } = await recentCheckins();

  return (
    <main className="vn-page" style={{ maxWidth: "42rem" }}>
      <p className="vn-eyebrow">Check-in</p>
      <h1 className="vn-heading mb-3">How have the last few days been?</h1>
      <p className="vn-body mb-8">
        Four quick questions between full retakes. This isn&rsquo;t a Vikriti result and isn&rsquo;t scored as one:
        it&rsquo;s a light signal that feeds your &ldquo;Today&rdquo; card and shows how things move week to week.
      </p>

      {ready ? (
        <CheckinForm />
      ) : (
        <p className="vn-card text-sm" style={{ color: "var(--ink-mid)" }}>
          Check-ins aren&rsquo;t set up on the server yet. They&rsquo;ll appear here once the latest database update has
          been applied.
        </p>
      )}

      {rows.length > 0 && (
        <section className="mt-10">
          <h2 className="mb-2 text-xs uppercase" style={{ letterSpacing: "0.06em", color: "var(--green-text)" }}>
            Recent check-ins
          </h2>
          <ul className="flex flex-col gap-1 text-sm" style={{ color: "var(--ink-mid)" }}>
            {rows.map((r) => (
              <li key={r.id}>
                <span style={{ color: "var(--ink)" }}>{fmt(r.completedAt)}</span> · {summariseCheckin(r.answers)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
