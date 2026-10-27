import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import type { Plugin } from "vite";
import { componentTagger } from "lovable-tagger";
import { ALL_ROUTES, getRouteMeta } from "./src/data/routeMeta";
import { routeHtml } from "./scripts/routeHtml";
import { buildSitemap } from "./scripts/sitemap";
import { GUIDES, guideArticleHtml, guideFaqJsonLd, guidesIndexBodyHtml } from "./src/data/guides";

function routeMetadataHtml(): Plugin {
  let outDir = "";
  return {
    name: "valu8-route-metadata-html",
    apply: "build",
    configResolved(config) { outDir = path.resolve(config.root, config.build.outDir); },
    closeBundle() {
      const indexPath = path.join(outDir, "index.html");
      const shell = fs.readFileSync(indexPath, "utf8");
      // Validate and update the homepage from the same source as every route.
      fs.writeFileSync(indexPath, routeHtml(shell, getRouteMeta("/")));
      for (const meta of ALL_ROUTES) {
        if (meta.path === "/") continue;
        const fileBase = path.join(outDir, meta.path.slice(1));
        const guide = GUIDES.find((g) => g.path === meta.path);
        const extra = meta.path === "/guides"
          ? { bodyHtml: guidesIndexBodyHtml() }
          : guide
            ? { bodyHtml: guideArticleHtml(guide), headHtml: '<script type="application/ld+json" id="guide-faq-jsonld">' + guideFaqJsonLd(guide) + '</script>' }
            : undefined;
        const html = routeHtml(shell, meta, false, extra);
        fs.mkdirSync(fileBase, { recursive: true });
        fs.writeFileSync(path.join(fileBase, "index.html"), html);
        fs.writeFileSync(`${fileBase}.html`, html);
      }
      fs.writeFileSync(path.join(outDir, "404.html"), routeHtml(shell, {
        path: "/404", title: "Page not found — Valu8",
        description: "This page doesn't exist. Value your car free with Valu8.", noindex: true,
      }, true));
      fs.writeFileSync(path.join(outDir, "sitemap.xml"), buildSitemap());
    },
  };
}

// Branding PNGs live in branding/*.png.b64 (text-only commit tooling). Serve them in dev and
// emit them at the site root on build so https://valu8.uk/og-v2.png, /logo-v2.png, /favicon-v2.ico,
// /apple-touch-icon-v2.png, /icon-512-v2.png and /email-logo.png (email header, 300x126 on #0b1111) exist (legacy /og.png, /logo.png kept but unreferenced).
function brandingAssets(): Plugin {
  const dir = path.resolve(__dirname, "branding");
  const read = (name: string) => {
    const f = path.join(dir, `${name}.b64`);
    return fs.existsSync(f) ? Buffer.from(fs.readFileSync(f, "utf8").replace(/\s+/g, ""), "base64") : null;
  };
  const names = ["og.png", "og-v2.png", "logo.png", "logo-v2.png", "favicon-v2.ico", "apple-touch-icon-v2.png", "icon-512-v2.png", "email-logo.png"];
  return {
    name: "valu8-branding-assets",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const name = (req.url || "").split("?")[0].replace(/^\//, "");
        const buf = names.includes(name) ? read(name) : null;
        if (!buf) return next();
        res.setHeader("Content-Type", name.endsWith(".ico") ? "image/x-icon" : "image/png");
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
  plugins: [react(), brandingAssets(), routeMetadataHtml(), mode === "development" && componentTagger()].filter(Boolean),
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
