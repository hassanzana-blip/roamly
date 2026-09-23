import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

/** «Reduser bevegelse» i iOS-innstillingene: glidende ark blir tone-inn, bilder vises uten overgang. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (active) setReduced(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v: boolean) => setReduced(v));
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
