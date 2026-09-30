import TickAssessment from "@/components/TickAssessment";
import RetakeGate from "@/components/RetakeGate";
import prakriti from "@/lib/prakriti.json";

export default function VikritiPage() {
  return (
    <RetakeGate instrument="vikriti">
      <TickAssessment
        instrument="vikriti"
        items={prakriti.vikriti_check.items}
        minTicks={0}
        maxTicks={3}
        askContext
        eyebrow="Vikriti"
        heading="Current state"
        intro="Only the last 4-6 weeks count here, not your lifelong pattern. Tick everything that has been true, or nothing in a group if none fits. Retake it every month or so to see how your current state moves."
      />
    </RetakeGate>
  );
}
