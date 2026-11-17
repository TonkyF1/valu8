import { forwardRef, type AnchorHTMLAttributes, type MouseEvent } from "react";
import { Link, useLocation } from "react-router-dom";
import { HOME_EVENT } from "@/lib/flowHistory";

/** Where every "home" and "Value a car" link goes: the homepage flow, at its start. */
export const START_PATH = "/";

/**
 * Link to the start of the homepage flow. From another page it opens the homepage at the top.
 * On the homepage itself it resets the flow to the reg card (with history unwound) and glides to the top,
 * instead of doing nothing. `focusReg` puts the cursor in the reg box afterwards ("Value a car").
 */
export const HomeLink = forwardRef<HTMLAnchorElement, AnchorHTMLAttributes<HTMLAnchorElement> & { focusReg?: boolean }>(
  function HomeLink({ focusReg, onClick, children, ...rest }, ref) {
    const { pathname } = useLocation();
    const handle = (e: MouseEvent<HTMLAnchorElement>) => {
      onClick?.(e);
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (pathname === START_PATH) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent(HOME_EVENT, { detail: { focusReg: !!focusReg } }));
      }
    };
    return (
      <Link ref={ref} to={START_PATH} onClick={handle} data-home-link="" {...rest}>{children}</Link>
    );
  },
);
