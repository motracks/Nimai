import LikertAssessment from "@/components/LikertAssessment";
import RetakeGate from "@/components/RetakeGate";
import guna from "@/lib/guna.json";

export default function GunaPage() {
  return (
    <RetakeGate instrument="guna">
      <LikertAssessment
        instrument="guna"
        data={guna}
        eyebrow="Guna"
        heading="Sattva · Rajas · Tamas"
        tag="Guna"
        askContext
      />
    </RetakeGate>
  );
}
