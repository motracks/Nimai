import { createClient } from "@/lib/supabase/server";
import { INSTRUMENTS, type InstrumentKey } from "@/lib/instruments";

export interface InstrumentStatus {
  key: string;
  label: string;
  sub: string;
  fullLabel: string;
  testHref: string;
  complete: boolean;
  // Set when the suggested retake interval has passed since the latest result.
  retakeDue: boolean;
}

const NAV: { key: InstrumentKey | "vedic"; label: string; sub: string; fullLabel: string; testHref: string }[] = [
  { key: "bigfive", label: "Personality", sub: "Big Five", fullLabel: "Big Five Personality", testHref: "/bigfive" },
  { key: "ecrr", label: "Attachment", sub: "ECR-R", fullLabel: "Attachment Style (ECR-R)", testHref: "/ecrr" },
  { key: "guna", label: "Guna", sub: "Sattva · Rajas · Tamas", fullLabel: "Guna (Sattva/Rajas/Tamas)", testHref: "/guna" },
  { key: "prakriti", label: "Prakriti", sub: "Vata · Pitta · Kapha", fullLabel: "Prakriti (Vata/Pitta/Kapha)", testHref: "/prakriti" },
  { key: "vikriti", label: "Vikriti", sub: "current state", fullLabel: "Vikriti (current state)", testHref: "/vikriti" },
  { key: "vedic", label: "Vedic chart", sub: "optional", fullLabel: "Vedic Birth Chart", testHref: "/vedic" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getInstrumentStatuses(): Promise<{
  user: { id: string } | null;
  instruments: InstrumentStatus[];
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      user: null,
      instruments: NAV.map((i) => ({ ...i, complete: false, retakeDue: false })),
    };
  }

  const [latest, vedic] = await Promise.all([
    supabase.from("current_assessment_results").select("instrument, completed_at"),
    supabase.from("vedic_charts").select("user_id").maybeSingle(),
  ]);

  const latestAt = new Map<string, string>(
    (latest.data ?? []).map((r) => [r.instrument as string, r.completed_at as string]),
  );

  return {
    user,
    instruments: NAV.map((i) => {
      if (i.key === "vedic") return { ...i, complete: Boolean(vedic.data), retakeDue: false };
      const at = latestAt.get(i.key);
      const retakeDue =
        at != null && Date.now() - new Date(at).getTime() > INSTRUMENTS[i.key].suggestedRetakeDays * DAY_MS;
      return { ...i, complete: at != null, retakeDue };
    }),
  };
}
