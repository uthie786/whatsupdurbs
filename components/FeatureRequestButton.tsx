import { Star } from "lucide-react";
import { FEATURE_FEE, featureRequestMailto } from "@/lib/site";

/** Opens the organiser's email app with a pre-filled feature request. */
export default function FeatureRequestButton(props: Parameters<typeof featureRequestMailto>[0]) {
  return (
    <div className="space-y-1.5">
      <a href={featureRequestMailto(props)} className="brutal-btn bg-durbs-yellow">
        <Star className="h-4 w-4" strokeWidth={3} /> Get featured · {FEATURE_FEE}
      </a>
      <p className="text-xs font-semibold text-neutral-700">
        Top spot on the homepage and in the featured carousel. We&apos;ll email you the payment details.
      </p>
    </div>
  );
}
