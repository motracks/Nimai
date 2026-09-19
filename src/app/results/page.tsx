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
  const { data, error } = await supabase.from("bigfive_results").select("*").maybeSingle();

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="mb-4 text-xl font-semibold">Your Big Five result</h1>
      {error && <p className="text-red-600">{error.message}</p>}
      {!error && !data && <p>No result yet. Go take the assessment.</p>}
      {data && (
        <dl className="flex flex-col gap-2">
          {Object.entries(data.labels as Record<string, string>).map(([dim, label]) => (
            <div key={dim} className="flex justify-between border-b py-1">
              <dt className="font-mono text-sm">{dim}</dt>
              <dd>{label}</dd>
            </div>
          ))}
        </dl>
      )}
    </main>
  );
}
