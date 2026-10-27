export { SITE_URL } from "../data/routeMeta";
/** Public contact address. Needs MX/forwarding set up on valu8.uk to receive mail. */
export const CONTACT_EMAIL = "hello@valu8.uk";
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
