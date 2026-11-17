import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/** New page (link or navigate) starts at the top. Back/forward keeps the browser's own position; #anchors are left alone. */
export function RouteScrollTop() {
  const { pathname, hash } = useLocation();
  const nav = useNavigationType();
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) { first.current = false; return; }
    if (nav === "POP" || hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash, nav]);
  return null;
}
