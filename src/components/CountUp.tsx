import { useEffect, useRef, useState } from "react";

interface Props {
  value: number;
  duration?: number;
  prefix?: string;
  className?: string;
  format?: (n: number) => string;
}

function prefersReducedMotion(): boolean {
  try { return typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches; } catch { return false; }
}

/**
 * Animated number. The FINAL value is the source of truth: it is what screen
 * readers, copy/paste, print and screenshots get. Previously the visible number
 * was animation state, so when requestAnimationFrame was throttled (background
 * tab, headless capture, low-power mode) the card froze mid-count and showed a
 * different figure from the summary (e.g. £3,071 instead of £4,650).
 */
export function CountUp({ value, duration = 1100, prefix = "", className, format }: Props) {
  const [n, setN] = useState(value);
  const [animating, setAnimating] = useState(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current || prefersReducedMotion() || (typeof document !== "undefined" && document.hidden)) {
      setN(value); setAnimating(false); return;
    }
    startedRef.current = true;
    let raf = 0;
    const start = performance.now();
    setAnimating(true);
    const finish = () => { cancelAnimationFrame(raf); setN(value); setAnimating(false); };
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // easeOutCubic
      setN(Math.round(value * eased));
      if (p < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
    // Hard stop: never leave an intermediate number on screen.
    const timer = setTimeout(finish, duration + 150);
    const onVis = () => { if (document.hidden) finish(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { cancelAnimationFrame(raf); clearTimeout(timer); document.removeEventListener("visibilitychange", onVis); setN(value); };
  }, [value, duration]);

  const fmt = (x: number) => (format ? format(x) : x.toLocaleString());
  const finalText = `${prefix}${fmt(value)}`;
  return (
    <span className={className} aria-label={finalText} data-value={value}>
      <span aria-hidden="true">{animating ? `${prefix}${fmt(n)}` : finalText}</span>
    </span>
  );
}
