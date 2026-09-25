import { getInstrumentStatuses } from "@/lib/progress";
import RotaryNav from "@/components/RotaryNav";

export default async function NavBar() {
  const { instruments } = await getInstrumentStatuses();

  const items = instruments.map((i) => ({
    key: i.key,
    label: i.label,
    fullLabel: i.fullLabel,
    // A completed, current result jumps straight to that result on the home
    // page. Not taken yet, or due for a retake, opens the questionnaire.
    // Vedic has no `result-vedic` slot check needed — it's never past due.
    href: i.complete && !i.retakeDue ? `/#result-${i.key}` : i.testHref,
    complete: i.complete,
  }));

  return <RotaryNav items={items} />;
}
