# Frontend SEO architecture

- Keep public route metadata in the Node-safe `src/data/routeMeta.ts`; pages, build HTML and sitemaps consume it to prevent drift.
- Generate route head variants with a dependency-free build-only Vite plugin; preserve the SPA body and fail when required template tags are missing.