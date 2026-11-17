/**
 * Page scroll helpers for the home flow and route changes.
 * - scrollPageTop: close the iOS keyboard (blur), then glide to the top; instant for reduced motion.
 * - lockBodyScroll: iOS-safe body lock for sheets (position:fixed body with the scroll position restored on unlock).
 */
export function prefersReducedMotion(): boolean {
  try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/** Blur a focused text field so the iOS keyboard closes before the page moves. */
export function closeKeyboard(): void {
  if (typeof document === "undefined") return;
  const el = document.activeElement as HTMLElement | null;
  if (el && el !== document.body && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) el.blur();
}

export function scrollPageTop(opts: { instant?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  closeKeyboard();
  if (document.body.dataset.scrollLocked) return; // a sheet is open; never move the page under it
  const behavior: ScrollBehavior = opts.instant || prefersReducedMotion() ? "auto" : "smooth";
  // Next frame, so it runs after the keyboard starts closing and the new stage has laid out.
  const go = () => window.scrollTo({ top: 0, left: 0, behavior });
  if (typeof window.requestAnimationFrame === "function") window.requestAnimationFrame(go); else go();
}

let locks = 0;
let saved = { y: 0, style: "" };

/** Locks page scroll behind a sheet. Returns the unlock function (restores the exact scroll position). */
export function lockBodyScroll(): () => void {
  if (typeof document === "undefined") return () => {};
  const body = document.body;
  if (locks++ === 0) {
    saved = { y: window.scrollY || window.pageYOffset || 0, style: body.getAttribute("style") ?? "" };
    const gap = window.innerWidth - document.documentElement.clientWidth;
    Object.assign(body.style, {
      position: "fixed", top: `-${saved.y}px`, left: "0", right: "0", width: "100%", overflow: "hidden",
      ...(gap > 0 ? { paddingRight: `${gap}px` } : {}),
    });
    body.dataset.scrollLocked = "1";
  }
  let done = false;
  return () => {
    if (done) return; done = true;
    if (--locks > 0) return;
    if (saved.style) body.setAttribute("style", saved.style); else body.removeAttribute("style");
    delete body.dataset.scrollLocked;
    window.scrollTo({ top: saved.y, left: 0, behavior: "auto" });
  };
}
