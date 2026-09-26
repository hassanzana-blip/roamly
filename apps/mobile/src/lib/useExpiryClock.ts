import { useCallback, useEffect, useState } from "react";
import { AppState } from "react-native";

/** Lengste forsinkelse setTimeout tåler (~24,8 døgn); lengre ventetid deles opp. */
const MAX_DELAY = 2 ** 31 - 1;

/**
 * Tegner skjermen på nytt i det øyeblikket `expiresAt` passeres, og når appen kommer tilbake i forgrunnen
 * (tidtakere står stille i bakgrunnen). Utløpet selv regnes alltid fra klokken i det skjermen tegnes eller
 * kunden trykker (offerExpired) – dette sørger bare for at det skjer uten at noe annet endrer seg.
 * Returnerer `refresh`, som tegner på nytt med én gang (brukes når et trykk oppdager et utløp).
 */
export function useExpiryClock(expiresAt: string | undefined): () => void {
  const [, setTick] = useState(0);
  const refresh = useCallback(() => setTick((n) => n + 1), []);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    const at = expiresAt ? Date.parse(expiresAt) : NaN;
    if (!Number.isFinite(at)) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      // offerExpired: utløpt når expiresAt < nå. Allerede utløpt: skjermen viser det alt.
      if (Date.now() > at) return;
      timer = setTimeout(
        () => {
          if (Date.now() > at) refresh();
          else arm();
        },
        Math.min(at - Date.now() + 1, MAX_DELAY),
      );
    };
    arm();
    return () => clearTimeout(timer);
  }, [expiresAt, refresh]);

  return refresh;
}
