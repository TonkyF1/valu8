import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

/**
 * Auto-fit big price text (single figure or "£low–£high" range) so it never overflows its box,
 * at any width. It measures the FINAL text (not an animation frame) in a hidden copy that carries
 * the same class, so the CSS size (clamp, media queries) is the starting size, then scales down.
 * A range that would drop below a readable size wraps to two lines ("£low –" / "£high").
 */

export interface FitInput {
  avail: number; // usable width of the box (px)
  base: number; // CSS font-size before fitting (px)
  w1: number; // one-line width at base size
  w2: number; // widest line of the two-line layout at base size (0 = cannot split)
  minPx: number; // below this a range goes to two lines
  floorPx: number; // never smaller than this
}
export interface FitResult { fontSize: number | null; split: boolean }

/** Pure sizing rule (unit-tested). fontSize null = keep the CSS size. */
export function computeFit({ avail, base, w1, w2, minPx, floorPx }: FitInput): FitResult {
  if (!(avail > 0) || !(base > 0) || !(w1 > 0) || w1 <= avail) return { fontSize: null, split: false };
  const s1 = Math.floor(((base * avail) / w1) * 10) / 10;
  if (s1 >= minPx || !(w2 > 0)) return { fontSize: Math.max(floorPx, s1), split: false };
  if (w2 <= avail) return { fontSize: null, split: true };
  const s2 = Math.floor(((base * avail) / w2) * 10) / 10;
  return { fontSize: Math.max(floorPx, s2), split: true };
}

/** "£4,023,700–£4,882,500" -> ["£4,023,700 –", "£4,882,500"]; anything else -> null. */
export function splitRange(text: string): [string, string] | null {
  const parts = text.split(/\s*–\s*/);
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return [`${parts[0]}\u00A0–`, parts[1]]; // no-break space: survives the odometer's inline-block chars
}

const SAFETY = 0.97; // thin Sora glyphs overhang slightly, keep a little air either side

interface Props {
  /** Final text, used for measuring and for screen readers. */
  text: string;
  /** Class that sets the font (and its CSS size). Applied to the visible element and the hidden measure. */
  className?: string;
  style?: CSSProperties;
  /** Box (block, full width) class, e.g. for alignment. */
  boxClassName?: string;
  align?: "center" | "left";
  minPx?: number;
  floorPx?: number;
  /** Allow the two-line layout for ranges. */
  allowSplit?: boolean;
  /** Render the visible lines (e.g. the odometer). Defaults to plain text. */
  children?: (lines: string[]) => ReactNode;
  testId?: string;
}

export function FitPrice({ text, className, style, boxClassName, align = "center", minPx = 28, floorPx = 12, allowSplit = true, children, testId }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const measure = useRef<HTMLSpanElement>(null);
  const [fit, setFit] = useState<FitResult>({ fontSize: null, split: false });
  const pair = allowSplit ? splitRange(text) : null;

  const run = useCallback(() => {
    const b = box.current, m = measure.current;
    if (!b || !m) return;
    const kids = m.children as HTMLCollectionOf<HTMLElement>;
    const w1 = kids[0]?.offsetWidth ?? 0;
    const w2 = pair ? Math.max(kids[1]?.offsetWidth ?? 0, kids[2]?.offsetWidth ?? 0) : 0;
    const base = parseFloat(getComputedStyle(m).fontSize) || 0;
    const cs = getComputedStyle(b);
    const inner = b.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    const next = computeFit({ avail: inner * SAFETY, base, w1, w2, minPx, floorPx });
    setFit((p) => (p.fontSize === next.fontSize && p.split === next.split ? p : next));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, minPx, floorPx, allowSplit]);

  useLayoutEffect(() => {
    run();
    const b = box.current;
    let ro: ResizeObserver | undefined;
    if (b && typeof ResizeObserver !== "undefined") { ro = new ResizeObserver(() => run()); ro.observe(b); }
    const fonts = typeof document !== "undefined" ? (document as Document & { fonts?: FontFaceSet }).fonts : undefined;
    let alive = true;
    fonts?.ready?.then(() => { if (alive) run(); }).catch(() => {});
    const onFont = () => run();
    fonts?.addEventListener?.("loadingdone", onFont);
    window.addEventListener("orientationchange", onFont);
    return () => { alive = false; ro?.disconnect(); fonts?.removeEventListener?.("loadingdone", onFont); window.removeEventListener("orientationchange", onFont); };
  }, [run]);

  const lines = fit.split && pair ? [pair[0], pair[1]] : [text];
  const visStyle: CSSProperties = {
    ...style,
    whiteSpace: "nowrap",
    ...(fit.fontSize ? { fontSize: `${fit.fontSize}px` } : null),
    ...(fit.split ? { display: "inline-flex", flexDirection: "column", alignItems: align === "center" ? "center" : "flex-start", rowGap: "0.1em" } : null),
  };
  return (
    <div ref={box} className={`v8-fit${boxClassName ? ` ${boxClassName}` : ""}`} style={{ position: "relative", width: "100%", minWidth: 0, textAlign: align }} data-testid={testId}>
      <span ref={measure} className={className} aria-hidden="true"
        style={{ ...style, position: "absolute", left: 0, top: 0, maxWidth: "none", visibility: "hidden", pointerEvents: "none", whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "flex-start", width: "max-content", height: "auto" }}>
        <span style={{ display: "inline-block" }}>{text}</span>
        {pair && <span style={{ display: "inline-block" }}>{pair[0]}</span>}
        {pair && <span style={{ display: "inline-block" }}>{pair[1]}</span>}
      </span>
      <span className={className} style={visStyle} role="text" aria-label={text} data-fit-size={fit.fontSize ?? ""} data-fit-split={fit.split ? "1" : "0"}>
        <span aria-hidden="true" style={{ display: "contents" }}>
          {children ? children(lines) : lines.map((l, i) => <span key={i} className="v8-fit-line">{l}</span>)}
        </span>
      </span>
    </div>
  );
}
