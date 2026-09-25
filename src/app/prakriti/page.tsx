import TickAssessment from "@/components/TickAssessment";
import prakriti from "@/lib/prakriti.json";

export default function PrakritiPage() {
  return (
    <TickAssessment
      instrument="prakriti"
      items={prakriti.items}
      minTicks={1}
      maxTicks={2}
      eyebrow="Prakriti"
      heading="Vata · Pitta · Kapha"
      intro="Answer for how you have been for most of your life, not just lately. Tick the one option that fits best; if two fit equally, tick both, but do this sparingly."
    />
  );
}
