// Every route, for build-time code (vite.config.ts prerender, sitemap, IndexNow) and tests.
// The app itself uses getRouteMeta (routeMeta.ts) or getValueRouteMeta (valueRoutes.ts).
import { BASE_ROUTES, type RouteMeta } from "./routeMeta";
import { VALUE_ROUTES } from "./valueRoutes";

export const ALL_ROUTES: RouteMeta[] = [...BASE_ROUTES, ...VALUE_ROUTES];

export function getAnyRouteMeta(path: string): RouteMeta {
  const pathname = path.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  const meta = ALL_ROUTES.find((route) => route.path === pathname);
  if (!meta) throw new Error(`Missing route metadata: ${pathname}`);
  return meta;
}
