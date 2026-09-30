import LikertAssessment from "@/components/LikertAssessment";
import RetakeGate from "@/components/RetakeGate";
import bigfive from "@/lib/bigfive.json";

export default function BigFivePage() {
  return (
    <RetakeGate instrument="bigfive">
      <LikertAssessment
        instrument="bigfive"
        data={bigfive}
        eyebrow="Personality"
        heading="Big Five"
        tag="Big Five"
      />
    </RetakeGate>
  );
}
