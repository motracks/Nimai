import LikertAssessment from "@/components/LikertAssessment";
import guna from "@/lib/guna.json";

export default function GunaPage() {
  return <LikertAssessment instrument="guna" data={guna} eyebrow="Guna" heading="Sattva · Rajas · Tamas" tag="Guna" />;
}
