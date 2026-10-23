/**
 * Owner-editable legal identity. These are the ONLY two values to fill in.
 * - LEGAL_NAME: your full name or trading name (e.g. "Jane Smith trading as Valu8").
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
