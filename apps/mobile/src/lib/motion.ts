import { useEffect, useState } from "react";
import { AccessibilityInfo, LayoutAnimation, type LayoutAnimationConfig } from "react-native";

/**
 * Det iOS sist svarte om «Reduser bevegelse» (null før det første svaret). Skjermer som tegnes senere, starter med
 * riktig verdi i stedet for å anta bevegelse til svaret kommer – en animasjon som starter når skjermen kommer (som
 * ruteoverskriften i resultatene), rekker ellers å bevege seg før appen vet at den ikke skal.
 */
let known: boolean | null = null;

/** «Reduser bevegelse» i iOS-innstillingene: glidende ark blir tone-inn, bilder vises uten overgang. */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => known ?? false);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        known = v;
        if (active) setReduced(v);
      })
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (v: boolean) => {
      known = v;
      setReduced(v);
    });
    return () => {
      active = false;
      sub.remove();
    };
  }, []);
  return reduced;
}

/**
 * «Reduser bevegelse» slik appen kjenner den akkurat nå: true/false, eller null før iOS har svart første gang. For det
 * som bestemmes én gang når noe tegnes – ukjent betyr «ingen bevegelse», så ingenting glir før vi vet.
 */
export function reducedMotionNow(): boolean | null {
  return known;
}

/** Bare for tester: sett det iOS «har svart» (null = ikke svart ennå), så rekkefølgen på testene ikke betyr noe. */
export function __setReducedMotionForTests(value: boolean | null): void {
  known = value;
}

/**
 * Tempoet i appens bevegelser, som hos Apple: kort og mykt ut (rask start, rolig landing). 260 ms er nok til at øyet
 * følger med, uten at noen venter på en animasjon.
 */
export const MOTION_MS = 260;

/** Størrelser og plasseringer glir på plass; det nye tones inn og det gamle ut – samtidig, som én forvandling. */
const GLIDE: LayoutAnimationConfig = {
  duration: MOTION_MS,
  create: { type: "easeOut", property: "opacity" },
  update: { type: "easeOut" },
  delete: { type: "easeOut", property: "opacity" },
};

/** «Reduser bevegelse»: størrelsen endres med én gang (ingen `update`), og innholdet bare tones over. */
const CROSSFADE: LayoutAnimationConfig = {
  duration: 200,
  create: { type: "easeInEaseOut", property: "opacity" },
  delete: { type: "easeInEaseOut", property: "opacity" },
};

/**
 * Neste tegning animeres av iOS selv (LayoutAnimation): øya som vokser eller krymper, og listen under som flytter
 * seg med, beveger seg i samme tempo – uten at hver del må vite om de andre. Kalles rett før tilstanden endres.
 * Med «Reduser bevegelse»: ingen bevegelse og ingen størrelsesanimasjon, bare en toning.
 */
export function animateNextLayout(reduced: boolean): void {
  LayoutAnimation.configureNext(reduced ? CROSSFADE : GLIDE);
}
