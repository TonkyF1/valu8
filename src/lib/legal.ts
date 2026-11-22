/**
 * Owner-editable legal identity. These are the ONLY two values to fill in.
 * - LEGAL_NAME: your full name or trading name (e.g. "Jane Smith trading as Valu8").
 * - LEGAL_ADDRESS: optional. Leave "" to publish no postal address.
 * Empty values are simply omitted from the Privacy and Terms pages; nothing placeholder-like is ever shown.
 */
export const LEGAL_NAME = "Tony Fisher trading as Valu8";
export const LEGAL_ADDRESS = "";

/** Sentence identifying who runs Valu8, used on Privacy and Terms. */
export function operatorSentence(name: string = LEGAL_NAME, address: string = LEGAL_ADDRESS): string {
  const n = name.trim();
  const a = address.trim();
  if (!n) return "Valu8 (valu8.uk) is the data controller for the personal data described here.";
  return `Valu8 (valu8.uk) is operated by ${n}${a ? `, ${a}` : ""}, who is the data controller for the personal data described here.`;
}

/** ICO data protection registration (public register entry). Shown on About and Privacy. */
export const ICO_REGISTRATION = "ZC283979";
export const ICO_REGISTERED_ON = "4 November 2026";

/**
 * Optional founder photo for the About page: a path under /public (e.g. "/founder.jpg").
 * Leave "" to show no photo; nothing placeholder-like is ever rendered.
 */
export const FOUNDER_PHOTO = "";
export const FOUNDER_PHOTO_ALT = "Tony Fisher, who runs Valu8";
