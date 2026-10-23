import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import type { Plugin } from "vite";
import { componentTagger } from "lovable-tagger";

// Branding PNGs live in branding/*.png.b64 (text-only commit tooling). Serve them in dev and
// emit them at the site root on build so https://valu8.uk/og.png and /logo.png exist.
function brandingAssets(): Plugin {
  const dir = path.resolve(__dirname, "branding");
  const read = (name: string) => {
    const f = path.join(dir, `${name}.b64`);
    return fs.existsSync(f) ? Buffer.from(fs.readFileSync(f, "utf8").replace(/\s+/g, ""), "base64") : null;
  };
  const names = ["og.png", "logo.png"];
  return {
    name: "valu8-branding-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url || "").split("?")[0].replace(/^\//, "");
        const buf = names.includes(name) ? read(name) : null;
        if (!buf) return next();
        res.setHeader("Content-Type", "image/png");
        res.end(buf);
      });
    },
    generateBundle() {
      for (const name of names) {
        const buf = read(name);
        if (buf) this.emitFile({ type: "asset", fileName: name, source: buf });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), brandingAssets(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // jspdf/recharts are left to Rollup so they stay in lazy route chunks.
        // Long-lived vendor chunks so returning visitors only re-download app code.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/[\\/](react|react-dom|react-router|react-router-dom|scheduler)[\\/]/.test(id)) return "react";
          if (id.includes("@supabase")) return "supabase";
          if (id.includes("@radix-ui")) return "radix";
          return undefined;
        },
      },
    },
  },
}));
