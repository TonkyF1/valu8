# Valu8 — Native iOS Build (Capacitor)

Capacitor is already wired up (`capacitor.config.ts`). To run the app on an iPhone or simulator:

## One-time setup

1. **Export to GitHub** from Lovable (top-right button) and `git pull` the repo locally.
2. Install deps:
   ```bash
   npm install
   ```
3. Add the iOS platform:
   ```bash
   npx cap add ios
   ```
4. (Optional) add Android in the same way:
   ```bash
   npx cap add android
   ```

## Every time you pull new code

```bash
npm install
npm run build
npx cap sync
```

## Run on simulator / device

```bash
npx cap run ios       # requires macOS + Xcode
# or open the native project:
npx cap open ios
```

Press the Run button in Xcode. Sign the bundle with your Apple Developer team in **Signing & Capabilities**.

## App Store submission checklist

- [ ] Remove the `server` block in `capacitor.config.ts` so the bundled web assets are used instead of the Lovable preview URL.
- [ ] Run `npm run build && npx cap sync ios` so the latest assets are baked in.
- [ ] Generate App Store icons (1024×1024) and splash screens in Xcode (Assets.xcassets).
- [ ] Set bundle identifier in Xcode to `app.lovable.101f88bb9f154d61bcf3d147a9f39355` (or your own reverse-domain ID).
- [ ] Fill in app metadata, screenshots, privacy questionnaire (data we collect: email, vehicle photos, vehicle details; no tracking).
- [ ] Archive → upload to App Store Connect.

## Notes

- `appId`: `app.lovable.101f88bb9f154d61bcf3d147a9f39355`
- `appName`: `Valu8`
- Splash + status bar are themed dark (`#111111`) to match the app.
- Safe-area insets are handled in `src/index.css` (top/bottom padding on `<body>`).
