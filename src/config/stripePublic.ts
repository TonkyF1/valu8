// Stripe publishable key (public by design; safe in client bundle).
export const STRIPE_PUBLISHABLE_KEY = 'pk_live_51UYCa32Eh7OGTq97fTqbZpHIlSDRoeLAB9Ihb2F0XzeWzSfTD2dk5zmRCkPt8onTYLQcasvoCl3M2QSAI00EZFt000I2Mq5vzu';

// £2.99 Full Report checkout switch (committed default; Lovable's .env is auto-generated).
// An explicit VITE_PREMIUM_ENFORCED=false in env still turns it off.
export const PREMIUM_ENFORCED_DEFAULT = true;
