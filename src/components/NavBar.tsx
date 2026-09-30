import { getInstrumentStatuses } from "@/lib/progress";
import RotaryNav from "@/components/RotaryNav";

export default async function NavBar() {
  const { instruments } = await getInstrumentStatuses();

  const items = instruments.map((i) => ({
    key: i.key,
    label: i.label,
    fullLabel: i.fullLabel,
    // A completed, current result opens its own fixed page. Not taken yet,
    // or due for a retake, opens the questionnaire.
    href: i.complete && !i.retakeDue ? `/results/${i.key}` : i.testHref,
    // Every page that belongs to this item, so the dial lines up with it
    // however it was reached (home page link, compass, bookmark).
    paths: [i.testHref, `/results/${i.key}`],
    complete: i.complete,
  }));

  return <RotaryNav items={items} />;
}
