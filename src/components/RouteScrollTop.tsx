import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * New page (link or navigate) starts at the top. Back/forward keeps the browser's own position; #anchors are left alone.
 * Only a change of page counts: the homepage flow's own history steps (same path, step in history.state) scroll themselves.
 */
export function RouteScrollTop() {
  const { pathname, hash } = useLocation();
  const nav = useNavigationType();
  const prev = useRef(pathname);
  useLayoutEffect(() => {
    const changed = prev.current !== pathname;
    prev.current = pathname;
    if (!changed || nav === "POP" || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash, nav]);
  return null;
}
