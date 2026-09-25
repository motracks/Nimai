import TickAssessment from "@/components/TickAssessment";
import prakriti from "@/lib/prakriti.json";

export default function VikritiPage() {
  return (
    <TickAssessment
      instrument="vikriti"
      items={prakriti.vikriti_check.items}
      minTicks={0}
      maxTicks={3}
      eyebrow="Vikriti"
      heading="Current state"
      intro="Only the last 4-6 weeks count here, not your lifelong pattern. Tick everything that has been true, or nothing in a group if none fits. Retake it every month or so to see how your current state moves."
    />
  );
}
