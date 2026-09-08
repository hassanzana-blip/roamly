import { useEffect, useRef } from "react";

/**
 * Lås skjermen når den har stått urørt.
 *
 * Serveren låser uansett når den ser at det er lenge siden forrige kall, men
 * den ser jo bare kall. En skjerm som står åpen på et kontor sender ingen, så
 * uten dette ville låsen først slått inn i det noen faktisk rørte den – altså
 * for sent. Her ber vi om låsen selv, med én gang tiden er ute.
 *
 * Vi lytter på det som faktisk betyr «noen er her»: taster, mus, berøring,
 * rulling. `pointermove` er utelatt med vilje – en mus som dulter borti et
 * bord skal ikke holde en tom skjerm åpen.
 */
const ACTIVITY = ["keydown", "pointerdown", "wheel", "touchstart", "focusin"] as const;

export function useIdleLock(afterMs: number, onIdle: () => void, enabled = true) {
  // Callbacken holdes i en ref slik at en ny funksjon på hver render ikke
  // river ned og setter opp lytterne på nytt – da ville klokka aldri løpe ut.
  // Oppdateringen skjer i en effekt, ikke under render.
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return;
    let timer = 0;

    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => onIdleRef.current(), afterMs);
    };

    // En skjult fane teller ikke som tilstedeværelse; kommer den fram igjen,
    // starter klokka på nytt.
    const onVisibility = () => {
      if (document.visibilityState === "visible") arm();
    };

    arm();
    for (const e of ACTIVITY) window.addEventListener(e, arm, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearTimeout(timer);
      for (const e of ACTIVITY) window.removeEventListener(e, arm);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [afterMs, enabled]);
}
