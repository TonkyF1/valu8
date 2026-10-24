# Branding assets

`og.png` (1200x630 social preview) and `logo.png` (512x512) are stored here as base64
text so they can be committed through text-only tooling. The `brandingAssets` plugin in
`vite.config.ts` decodes them and serves/emits them at `/og.png` and `/logo.png`.

Built from `src/assets/valu8-logo.png` + tagline "Know what your car is really worth"
(Pillow, Inter font). To regenerate: produce the PNG, then `base64 -w 76 og.png > branding/og.png.b64`.

## og-v2.png (current social preview)

`og-v2.png.b64` is the current 1200x630 og:image/twitter:image (`https://valu8.uk/og-v2.png`), using the real Valu8 wordmark (white "Valu" + teal "8", as on the X/Instagram avatars). `og.png` and `logo.png` are the old chrome-style artwork and are NOT the Valu8 logo; nothing in index.html points to `og.png` any more. `logo.png` is still referenced by the JSON-LD Organization logo until a replacement is made.

## Icons and logo v2 (real wordmark)

- `favicon-v2.ico` (16/32/48): teal italic "8" on the dark brand background, rounded corners.
- `apple-touch-icon-v2.png` (180x180) and `icon-512-v2.png` (512x512): same mark, full-bleed square.
- `logo-v2.png` (512x512): the "Valu" + teal "8" wordmark, used as the JSON-LD Organization logo.

`public/favicon.ico` (Lovable default) and the old `logo.png` are no longer referenced. `resources/icon.png` and `resources/splash.png` (native app icons) are separate and unchanged.
