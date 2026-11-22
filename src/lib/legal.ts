/**
 * Owner-editable legal identity. These are the ONLY two values to fill in.
 * - LEGAL_NAME: a trading name to publish, or "" to publish no personal name (the site then says "Valu8 (valu8.uk)").
 *   Tony asked (22 Nov 2026) for his name to be removed from the site: keep this "".
 * - LEGAL_ADDRESS: optional. Leave "" to publish no postal address.
 * Empty values are simply omitted from the Privacy and Terms pages; nothing placeholder-like is ever shown.
 */
export const LEGAL_NAME = "";
export const LEGAL_ADDRESS = "";

/** Sentence identifying who runs Valu8, used on Privacy and Terms. */
export function operatorSentence(name: string = LEGAL_NAME, address: string = LEGAL_ADDRESS): string {
  const n = name.trim();
  const a = address.trim();
  if (!n) return "Valu8 (valu8.uk) is the data controller for the personal data described here.";
  return `Valu8 (valu8.uk) is operated by ${n}${a ? `, ${a}` : ""}, who is the data controller for the personal data described here.`;
}
