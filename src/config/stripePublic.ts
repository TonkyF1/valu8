// Stripe publishable key (public by design; safe in client bundle).
export const STRIPE_PUBLISHABLE_KEY = '[REDACTED]';

// £2.99 Full Report checkout switch (committed default; Lovable's .env is auto-generated).
// An explicit VITE_PREMIUM_ENFORCED=false in env still turns it off.
export const PREMIUM_ENFORCED_DEFAULT = false; // off until STRIPE_SECRET_KEY is fixed (was a key ID, not an sk_live_ key)
