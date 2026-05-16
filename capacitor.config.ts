import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.101f88bb9f154d61bcf3d147a9f39355",
  appName: "Valu8",
  webDir: "dist",
  // Live-reload from the Lovable sandbox while developing on a real device.
  // Comment this `server` block out and rebuild before submitting to the App Store.
  server: {
    url: "https://101f88bb-9f15-4d61-bcf3-d147a9f39355.lovableproject.com?forceHideBadge=true",
    cleartext: true,
  },
  ios: {
    contentInset: "always",
    backgroundColor: "#111111",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: "#111111",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#111111",
      overlaysWebView: false,
    },
  },
};

export default config;
