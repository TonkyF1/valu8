import { Info } from "lucide-react";

// Kept separate from VehicleInsights so the landing page doesn't pull in recharts.
export function AccuracyDisclaimer() {
  return (
    <div className="rounded-lg border border-border/60 bg-muted/20 p-3 text-[11px] text-muted-foreground flex gap-2" role="note">
      <Info className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
      <p>
        <strong className="text-foreground">How accurate is this?</strong> Valuations are estimates based on UK adverts in our database
        (asking prices, not sold prices), DVSA records and AI analysis of your details and photos. Real sale prices vary with
        condition, spec, location and timing. Tax, ULEZ, recall and repair figures are indicative. Always confirm with the
        official GOV.UK and TfL services and get a professional inspection and history check before buying or selling.
      </p>
    </div>
  );
}

