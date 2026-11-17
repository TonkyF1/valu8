/**
 * Browser history for the single-page home flow (landing -> car and details -> result -> checkout).
 * Each forward step pushes one history entry on "/" (same URL, the step lives in history.state), so the
 * phone's Back button walks back through the flow before it ever leaves the site. Loader stages never push.
 */
export type FlowView = "entry" | "details" | "result" | "checkout";

export interface FlowHistoryState { v8?: FlowView; v8d?: number }

const RANK: Record<FlowView, number> = { entry: 0, details: 1, result: 2, checkout: 3 };
const VIEWS = Object.keys(RANK) as FlowView[];

/** The flow step recorded on a history entry (anything else counts as the landing step). */
export function viewOf(state: unknown): FlowView {
  const v = (state as FlowHistoryState | null)?.v8;
  return v && VIEWS.includes(v) ? v : "entry";
}

/** How many flow entries sit above the landing entry. */
export function depthOf(state: unknown): number {
  const d = Number((state as FlowHistoryState | null)?.v8d);
  return Number.isFinite(d) && d > 0 ? Math.floor(d) : 0;
}

/**
 * When the flow moves to `view`, the history state to push, or null when nothing should be pushed:
 * the entry already shows that step, or the flow moved backwards (Back, the X, or an explicit reset
 * handle their own history).
 */
export function pushFor(current: unknown, view: FlowView): FlowHistoryState | null {
  const on = viewOf(current);
  if (on === view || RANK[view] <= RANK[on]) return null;
  return { ...((current as object | null) ?? {}), v8: view, v8d: depthOf(current) + 1 };
}

export interface FlowCtx {
  view: FlowView;          // what the flow shows now (checkout when the sheet is open)
  hasLookup: boolean;      // a car has been looked up (details can be shown again)
  hasResult: boolean;      // a valuation result exists (result can be shown again)
  canCheckout: boolean;    // a valuation exists to pay for
}

export type FlowAction =
  | { kind: "none" }
  | { kind: "closeCheckout" }
  | { kind: "openCheckout" }
  | { kind: "show"; view: Exclude<FlowView, "checkout">; closeCheckout: boolean }
  | { kind: "replace"; view: FlowView }; // the entry can't be shown any more: rewrite it to what is on screen

/** What to do when Back (or Forward) lands on an entry recorded as `target`. */
export function popAction(target: FlowView, ctx: FlowCtx): FlowAction {
  if (target === ctx.view) return { kind: "none" };
  const sheetOpen = ctx.view === "checkout";
  if (target === "checkout") return ctx.canCheckout ? { kind: "openCheckout" } : { kind: "replace", view: ctx.view };
  if (target === "entry") return { kind: "show", view: "entry", closeCheckout: sheetOpen };
  if (target === "details") return ctx.hasLookup ? { kind: "show", view: "details", closeCheckout: sheetOpen } : { kind: "replace", view: ctx.view };
  // result
  if (sheetOpen && ctx.hasResult) return { kind: "closeCheckout" };
  return ctx.hasResult ? { kind: "show", view: "result", closeCheckout: sheetOpen } : { kind: "replace", view: ctx.view };
}

/** A snapshot of the flow kept for this tab, so coming Back from the report page (or a reload) restores the step. */
export const FLOW_SNAPSHOT_KEY = "valu8_flow_snap";

export function saveFlowSnapshot(snap: Record<string, unknown> | null): void {
  try {
    if (snap) sessionStorage.setItem(FLOW_SNAPSHOT_KEY, JSON.stringify({ ...snap, at: Date.now() }));
    else sessionStorage.removeItem(FLOW_SNAPSHOT_KEY);
  } catch { /* private mode */ }
}

/** The saved snapshot when it is recent (2 hours), else null. */
export function readFlowSnapshot<T = Record<string, unknown>>(maxAgeMs = 2 * 60 * 60 * 1000): T | null {
  try {
    const raw = sessionStorage.getItem(FLOW_SNAPSHOT_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s || typeof s !== "object" || !(Date.now() - Number(s.at) < maxAgeMs)) return null;
    return s as T;
  } catch { return null; }
}

/** Event the Valu8 logo and "Value a car" fire when the visitor is already on the homepage: back to the start. */
export const HOME_EVENT = "valu8:home";
