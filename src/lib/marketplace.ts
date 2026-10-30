// Format a generated advert for specific UK marketplaces. Pure + tested.
export type Marketplace = "autotrader" | "ebay" | "facebook" | "gumtree";

export const MARKETPLACES: { key: Marketplace; label: string; length: "short" | "medium" | "full"; url: string }[] = [
  { key: "autotrader", label: "AutoTrader", length: "full", url: "https://www.autotrader.co.uk/selling" },
  { key: "ebay", label: "eBay Motors", length: "full", url: "https://www.ebay.co.uk/sl/sell" },
  { key: "facebook", label: "Facebook Marketplace", length: "short", url: "https://www.facebook.com/marketplace/create/vehicle" },
];

export interface AdVehicle { make: string; model: string; year: number; mileage: number; price?: number; location?: string }

const EBAY_TITLE_MAX = 80; // eBay listing titles are limited to 80 characters.

export function adTitle(v: AdVehicle, max?: number): string {
  const parts = [String(v.year), v.make, v.model.replace(/\s*·\s*/g, " "), `${Math.round(v.mileage / 1000)}k miles`];
  let t = parts.join(" ").replace(/\s+/g, " ").trim();
  if (max && t.length > max) t = t.slice(0, max - 1).trimEnd() + "…";
  return t;
}

/** Strip markdown-ish formatting that some sites render literally. */
export function plain(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/^#+\s*/gm, "")
    .replace(/^\s*[-*•]\s+/gm, "• ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function formatForMarketplace(m: Marketplace, body: string, v: AdVehicle): string {
  const price = v.price ? `£${Math.round(v.price).toLocaleString("en-GB")}` : "";
  const clean = plain(body);
  switch (m) {
    case "ebay":
      return `TITLE: ${adTitle(v, EBAY_TITLE_MAX)}\n\n${clean}${price ? `\n\nPrice: ${price}` : ""}\nViewing welcome. Please message with any questions.`;
    case "facebook": {
      // Marketplace has separate price/mileage fields; keep the description short and friendly.
      const short = clean.split(/\n\n/).slice(0, 2).join("\n\n");
      return `${adTitle(v)}${price ? ` – ${price}` : ""}\n\n${short}${v.location ? `\n\n📍 ${v.location}` : ""}\nNo time-wasters, please. Happy to answer questions.`;
    }
    case "gumtree":
      return `${adTitle(v)}${price ? ` – ${price}` : ""}\n\n${clean}${v.location ? `\n\nLocation: ${v.location}` : ""}`;
    case "autotrader":
    default:
      return `${adTitle(v)}\n\n${clean}`;
  }
}
