import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { getConsent, onConsentChange } from "@/lib/consent";
import { onTrack } from "@/lib/funnel";
import { loadMetaPixel, metaEvent, metaPixelConfigured, revokeMetaPixel } from "@/lib/metaPixel";

/** Loads the Meta Pixel only after "Accept", then mirrors a few funnel steps as standard events. */
export function MetaPixelTracker() {
  const location = useLocation();
  const [on, setOn] = useState(() => metaPixelConfigured() && getConsent() === "granted");
  useEffect(() => onConsentChange((v) => {
    const yes = metaPixelConfigured() && v === "granted";
    if (!yes) revokeMetaPixel();
    setOn(yes);
  }), []);
  useEffect(() => {
    if (!on || !loadMetaPixel()) return;
    return onTrack((step) => {
      if (step === "valuation_completed") metaEvent("Lead", { content_name: "Free valuation" });
      else if (step === "report_checkout") metaEvent("InitiateCheckout", { value: 2.99, currency: "GBP" });
    });
  }, [on]);
  useEffect(() => { if (on) metaEvent("PageView"); }, [on, location.pathname]);
  return null;
}
