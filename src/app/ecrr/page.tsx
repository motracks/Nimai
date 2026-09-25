import LikertAssessment from "@/components/LikertAssessment";
import ecrr from "@/lib/ecrr.json";

export default function EcrrPage() {
  return <LikertAssessment instrument="ecrr" data={ecrr} eyebrow="Attachment" heading="ECR-R" tag="ECR-R" />;
}
