# Branding assets

`og.png` (1200x630 social preview) and `logo.png` (512x512) are stored here as base64
text so they can be committed through text-only tooling. The `brandingAssets` plugin in
`vite.config.ts` decodes them and serves/emits them at `/og.png` and `/logo.png`.

Built from `src/assets/valu8-logo.png` + tagline "Know what your car is really worth"
(Pillow, Inter font). To regenerate: produce the PNG, then `base64 -w 76 og.png > branding/og.png.b64`.
