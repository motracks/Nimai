import { createClient } from "@/lib/supabase/server";

export interface InstrumentStatus {
  key: string;
  label: string;
  sub: string;
  fullLabel: string;
  testHref: string;
  table: string;
  complete: boolean;
}

const INSTRUMENTS = [
  {
    key: "bigfive",
    label: "Personality",
    sub: "Big Five",
    fullLabel: "Big Five Personality",
    testHref: "/bigfive",
    table: "bigfive_results",
  },
  {
    key: "ecrr",
    label: "Attachment",
    sub: "ECR-R",
    fullLabel: "Attachment Style (ECR-R)",
    testHref: "/ecrr",
    table: "ecrr_results",
  },
  {
    key: "guna",
    label: "Guna",
    sub: "Sattva · Rajas · Tamas",
    fullLabel: "Guna (Sattva/Rajas/Tamas)",
    testHref: "/guna",
    table: "guna_results",
  },
  {
    key: "prakriti",
    label: "Prakriti",
    sub: "Vata · Pitta · Kapha",
    fullLabel: "Prakriti (Vata/Pitta/Kapha)",
    testHref: "/prakriti",
    table: "prakriti_results",
  },
  {
    key: "vedic",
    label: "Vedic chart",
    sub: "optional",
    fullLabel: "Vedic Birth Chart",
    testHref: "/vedic",
    table: "vedic_charts",
  },
] as const;

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
      instruments: INSTRUMENTS.map((i) => ({ ...i, complete: false })),
    };
  }

  const results = await Promise.all(
    INSTRUMENTS.map((i) => supabase.from(i.table).select("user_id").maybeSingle()),
  );

  return {
    user,
    instruments: INSTRUMENTS.map((i, idx) => ({
      ...i,
      complete: Boolean(results[idx].data),
    })),
  };
}
