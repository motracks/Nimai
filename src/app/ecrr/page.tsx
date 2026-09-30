import LikertAssessment from "@/components/LikertAssessment";
import RetakeGate from "@/components/RetakeGate";
import ecrr from "@/lib/ecrr.json";

export default function EcrrPage() {
  return (
    <RetakeGate instrument="ecrr">
      <LikertAssessment
        instrument="ecrr"
        data={ecrr}
        eyebrow="Attachment"
        heading="ECR-R"
        tag="ECR-R"
      />
    </RetakeGate>
  );
}
