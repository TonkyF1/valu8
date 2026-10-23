export const SITE_URL: string = (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, "") || "https://valu8.uk";
/** Public contact address. Needs MX/forwarding set up on valu8.uk to receive mail. */
export const CONTACT_EMAIL = "hello@valu8.uk";
export const TURNSTILE_SITE_KEY: string = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? "";
