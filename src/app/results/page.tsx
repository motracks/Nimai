import { redirect } from "next/navigation";

// Results now live inline on the home page (there is no reason for two
// near-identical pages) — this route stays only so old links and bookmarks
// still land somewhere.
export default function ResultsRedirect() {
  redirect("/");
}
