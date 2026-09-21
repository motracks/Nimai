import { getInstrumentStatuses } from "@/lib/progress";
import RotaryNav from "@/components/RotaryNav";

export default async function NavBar() {
  const { user, instruments } = await getInstrumentStatuses();

  const items = instruments.map((i) => ({
    key: i.key,
    label: i.label,
    fullLabel: i.fullLabel,
    href: user && i.complete ? "/results" : i.testHref,
    complete: i.complete,
  }));

  return <RotaryNav items={items} />;
}
