import { useEffect, useRef, useState } from "react";

const reduceMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Odometer price: each digit is a 0-9 column that rolls to its value (transform only), staggered right to left. */
export function RollingPrice({ text, className }: { text: string; className?: string }) {
  const [shown, setShown] = useState<string>(() => text.replace(/\d/g, "0"));
  useEffect(() => {
    if (reduceMotion()) { setShown(text); return; }
    // Two frames so the columns mount at 0 before rolling.
    let r2 = 0;
    const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setShown(text)); });
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2); };
  }, [text]);
  const chars = text.split("");
  const n = chars.length;
  return (
    <span className={className} aria-label={text} role="text">
      {chars.map((c, i) => {
        if (!/\d/.test(c)) return <span key={`c${i}`} className="t8-char" aria-hidden>{c}</span>;
        const d = /\d/.test(shown[i] ?? "") ? Number(shown[i]) : 0;
        return (
          <span key={`d${i}`} className="t8-digit" aria-hidden>
            <span style={{ transform: `translate3d(0,${-d}em,0)`, transitionDelay: `${(n - i) * 35}ms` }}>
              {Array.from({ length: 10 }, (_, k) => <i key={k}>{k}</i>)}
            </span>
          </span>
        );
      })}
    </span>
  );
}

// Arc geometry (viewBox 390x110): centre (195,180), r 168, from -145deg to -35deg.
const A0 = -145, A1 = -35;
const ARC = "M 57.38,83.64 A 168 168 0 0 1 332.62,83.64";

/** Teal band sweeping along the arc between two fractions (0..1). null = empty track. */
export function PriceArc({ from, to }: { from: number | null; to: number | null }) {
  const on = from != null && to != null;
  const a = on ? Math.max(0, Math.min(1, from!)) : 0.5;
  const b = on ? Math.max(a + 0.02, Math.min(1, to!)) : 0.5;
  const len = (b - a) * 1000;
  const angA = A0 + (A1 - A0) * a, angB = A0 + (A1 - A0) * b;
  return (
    <svg className="t8-arc" viewBox="0 0 390 110" aria-hidden="true">
      <defs>
        <linearGradient id="t8teal" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#00D6C8" /><stop offset="1" stopColor="#1AFFF0" />
        </linearGradient>
        <filter id="t8glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3.5" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>
      <path d={ARC} fill="none" stroke="#2A2A2A" strokeWidth="7" strokeLinecap="round" />
      <path className="t8-band" d={ARC} pathLength={1000} fill="none" stroke="url(#t8teal)" strokeWidth="7" strokeLinecap="round" filter="url(#t8glow)"
        style={{ strokeDasharray: `${on ? len : 0} 2000`, strokeDashoffset: -(on ? a : 0.5) * 1000, opacity: on ? 1 : 0 }} />
      <circle className="t8-dot" cx="363" cy="180" r="3.3" fill="#00D6C8" filter="url(#t8glow)" style={{ transform: `rotate(${on ? angA : -90}deg)`, opacity: on ? 1 : 0 }} />
      <circle className="t8-dot" cx="363" cy="180" r="3.3" fill="#1AFFF0" filter="url(#t8glow)" style={{ transform: `rotate(${on ? angB : -90}deg)`, opacity: on ? 1 : 0 }} />
    </svg>
  );
}

export interface LoaderStep { title: string; sub: string }

/** Tesla ring loader. progress 0-100; active step advances with progress. */
export function RingLoader({ title, status, steps, progress }: { title: string; status: string; steps: LoaderStep[]; progress: number }) {
  const C = 2 * Math.PI * 66;
  const p = Math.max(0, Math.min(100, progress));
  const active = p >= 100 ? steps.length : Math.min(steps.length - 1, Math.floor((p / 100) * steps.length));
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="t8-loader" role="status" aria-live="polite" tabIndex={-1} ref={ref}>
      <div className="t8-ring">
        <svg viewBox="0 0 148 148" aria-hidden="true">
          <circle cx="74" cy="74" r="66" fill="none" stroke="#2A2A2A" strokeWidth="6" />
          <circle className="p" cx="74" cy="74" r="66" fill="none" stroke="#00D6C8" strokeWidth="6" strokeLinecap="round"
            strokeDasharray={C} strokeDashoffset={C * (1 - p / 100)} style={{ filter: "drop-shadow(0 0 6px rgba(26,255,240,.55))" }} />
        </svg>
        <div className="t8-pct">{Math.round(p)}<small>%</small></div>
      </div>
      <h2>{title}</h2>
      <p className="t8-status">{status}</p>
      <div className="t8-steps">
        {steps.map((s, i) => (
          <div key={s.title} className={`t8-step ${i < active ? "done" : i === active ? "active" : "wait"}`}>
            <div className="t8-n">{i < active ? (
              <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2l2.3 2.3 4.7-4.9" stroke="#0F0F0F" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
            ) : i + 1}</div>
            <div><div className="t8-st">{s.title}</div><div className="t8-ss">{s.sub}</div></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Eased progress toward `cap` while the engine runs, then a smooth glide to 100 when done. */
export function useEasedProgress(running: boolean, done: boolean, ms = 22000, cap = 92) {
  const [p, setP] = useState(0);
  const cur = useRef(0);
  const set = (v: number) => { cur.current = v; setP(v); };
  useEffect(() => {
    if (!running) { set(0); return; }
    let raf = 0; const t0 = performance.now();
    if (done) {
      const from = cur.current;
      const tick = () => {
        const k = Math.min(1, (performance.now() - t0) / 900);
        set(from + (100 - from) * (1 - Math.pow(1 - k, 3)));
        if (k < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
      return () => cancelAnimationFrame(raf);
    }
    const id = window.setInterval(() => set(cap * (1 - Math.exp((-3 * (performance.now() - t0)) / ms))), 120);
    return () => clearInterval(id);
  }, [running, done, ms, cap]);
  return p;
}
