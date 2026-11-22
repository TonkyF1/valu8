import { createRoot } from "react-dom/client";
import App, { preloadRoute } from "./App.tsx";
import "./index.css";
import { initSentry } from "./lib/sentry";
import { captureFirstTouch } from "./lib/attribution";

captureFirstTouch();

initSentry();

const rootEl = document.getElementById("root")!;
const mount = () => createRoot(rootEl).render(<App />);
if (rootEl.firstElementChild) {
  // Prerendered page: let the static HTML paint, and fetch this route's code, before React takes over.
  // Rendering straight away swapped the visible page for a blank loading shell (and the page's main text was then
  // measured again ~150ms later as the LCP). Capped at 2.5s so a slow chunk never holds the page hostage.
  // Wait (briefly) for the preloaded fonts too: text still inside its font block period isn't painted yet.
  const fonts = Promise.race([document.fonts?.ready ?? Promise.resolve(), new Promise((r) => setTimeout(r, 200))]);
  const painted = fonts.then(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(r, 0)))));
  const code = Promise.race([preloadRoute(location.pathname).catch(() => undefined), new Promise((r) => setTimeout(r, 2500))]);
  void Promise.all([painted, code]).then(mount);
} else {
  mount();
}
