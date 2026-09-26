import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router";

/** Run inside Suspense so the new page exists before scrolling to its content. */
export default function RouteScroll() {
  const { pathname, hash } = useLocation();
  const navigation = useNavigationType();
  const previousPath = useRef<string | null>(null);

  useLayoutEffect(() => {
    const initialPage = previousPath.current === null;
    const changedPage = !initialPage && previousPath.current !== pathname;
    previousPath.current = pathname;
    // Back/forward keeps the browser's restoration; changing filters stays put.
    if ((navigation === "POP" && !initialPage) || pathname.startsWith("/admin")) return;
    if (hash) {
      let id = hash.slice(1);
      try { id = decodeURIComponent(id); } catch { /* Invalid escapes are literal IDs. */ }
      const scrollToSection = () => {
        const section = document.getElementById(id);
        section?.scrollIntoView({ behavior: "instant", block: "start" });
        return Boolean(section);
      };
      if (scrollToSection()) return;
      // BelowFold deliberately mounts sections after first paint. Wait for
      // the target, without changing that performance optimization.
      const observer = new MutationObserver(() => {
        if (scrollToSection()) stop();
      });
      const stop = () => {
        observer.disconnect();
        window.clearTimeout(timeout);
      };
      const timeout = window.setTimeout(stop, 5000);
      observer.observe(document.body, { childList: true, subtree: true });
      return stop;
    } else if (changedPage) {
      window.scrollTo({ left: 0, top: 0, behavior: "instant" });
    }
  }, [pathname, hash, navigation]);

  return null;
}
