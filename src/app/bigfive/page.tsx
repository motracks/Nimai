import LikertAssessment from "@/components/LikertAssessment";
import bigfive from "@/lib/bigfive.json";

export default function BigFivePage() {
  return <LikertAssessment instrument="bigfive" data={bigfive} eyebrow="Personality" heading="Big Five" tag="Big Five" />;
}
