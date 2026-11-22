import { lazy, type ComponentType } from "react";

/**
 * React.lazy that can be fetched ahead of rendering, and renders synchronously once fetched (no Suspense
 * fallback flash). Used so a prerendered page keeps its static HTML on screen until its route code is ready,
 * then React swaps in identical content (see main.tsx).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithPreload<P extends Record<string, any> = Record<string, never>>(factory: () => Promise<{ default: ComponentType<P> }>) {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<void> | null = null;
  const load = () => (pending ??= factory().then((m) => { loaded = m.default; }));
  const Lazy = lazy(() => load().then(() => ({ default: loaded as ComponentType<P> })));
  const C = (props: P) => {
    const L = loaded;
    return L ? <L {...props} /> : <Lazy {...(props as any)} />;
  };
  C.preload = load;
  return C;
}
