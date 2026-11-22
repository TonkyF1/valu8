import { type PointerEvent as RPointerEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from "react";
import { X } from "lucide-react";
import "@/styles/tesla.css";
import { lockBodyScroll, prefersReducedMotion } from "@/lib/scrollTop";

/**
 * Slide-up checkout sheet, built for iOS Safari:
 * - header (handle, title, close X) sits outside the scroll area, so it is always on screen;
 * - only the body scrolls (overscroll contained), and the page behind is locked and restored on close;
 * - the sheet follows the visual viewport, so the iOS keyboard or a growing Stripe frame never pushes the X off screen;
 * - closes with the X, a backdrop tap, Escape, or a swipe down on the header.
 */
export function CheckoutSheet({ title, label, onClose, children }: { title: string; label: string; onClose: () => void; children: (close: () => void) => ReactNode }) {
  const titleId = useId();
  const overlay = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => onCloseRef.current(), prefersReducedMotion() ? 0 : 280);
  }, []);

  // Page locked behind the sheet; opens scrolled to its top with focus on the dialog (no page jump).
  useEffect(() => {
    const unlock = lockBodyScroll();
    if (body.current) body.current.scrollTop = 0;
    panel.current?.focus({ preventScroll: true });
    return unlock;
  }, []);

  // Escape closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.preventDefault(); close(); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Track the visible area (iOS keyboard, toolbar collapse), so the header and X stay in view.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = overlay.current;
    if (!vv || !el) return;
    const sync = () => {
      el.style.setProperty("--co-top", `${Math.max(0, vv.offsetTop)}px`);
      el.style.setProperty("--co-h", `${vv.height}px`);
    };
    sync();
    vv.addEventListener("resize", sync);
    vv.addEventListener("scroll", sync);
    return () => { vv.removeEventListener("resize", sync); vv.removeEventListener("scroll", sync); };
  }, []);

  // Swipe down on the header to dismiss.
  const drag = useRef<{ y: number; dy: number; id: number } | null>(null);
  const onDown = (e: RPointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    drag.current = { y: e.clientY, dy: 0, id: e.pointerId };
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    if (panel.current) panel.current.style.transition = "none";
  };
  const onMove = (e: RPointerEvent) => {
    const d = drag.current; if (!d || d.id !== e.pointerId || !panel.current) return;
    d.dy = Math.max(0, e.clientY - d.y);
    panel.current.style.transform = `translate3d(0,${d.dy}px,0)`;
  };
  const onUp = (e: RPointerEvent) => {
    const d = drag.current; drag.current = null;
    if (!d || d.id !== e.pointerId || !panel.current) return;
    const p = panel.current;
    p.style.transition = "transform .32s cubic-bezier(.22,1,.36,1)";
    if (d.dy > 90) { p.dataset.swiped = "1"; p.style.transform = "translate3d(0,110%,0)"; close(); }
    else p.style.transform = "";
  };

  return (
    <div ref={overlay} className={`t8-checkout${closing ? " t8-co-out" : ""}`} data-testid="checkout-sheet"
      onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={panel} className="t8-checkout-in" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="t8-co-head" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
          <div className="t8-co-grab" aria-hidden />
          <div className="t8-co-bar">
            <h2 id={titleId} className="t8-co-title">{title}</h2>
            <button type="button" className="t8-co-x" aria-label="Close checkout" data-testid="checkout-close" onClick={close}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
        <div ref={body} className="t8-co-body" data-testid="checkout-body">{children(close)}</div>
      </div>
    </div>
  );
}
