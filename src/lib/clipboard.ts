/**
 * Kopier til utklippstavla, og si fra hvis det ikke gikk.
 *
 * `navigator.clipboard` finnes ikke over vanlig http, og kan avvises av
 * nettleseren uten at noe kastes der man ser det. Det er verst der teksten er
 * verdt noe – gjenopprettingskoder man tror man har lagret, en referanse man
 * tror ligger klar til å limes inn. Derfor: én vei inn, et ærlig ja eller nei
 * ut, og et fall tilbake til den gamle metoden når den nye ikke er tilgjengelig.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // Faller gjennom til metoden under.
  }

  if (typeof document === "undefined") return false;

  // Reservemetoden må låne fokus for å kunne markere teksten. Den gir det
  // tilbake etterpå: en kopiering skal ikke koste deg plassen i skjemaet du
  // sto i, eller stoppe tastaturet i kommandopaletten.
  const hadFocus = document.activeElement as HTMLElement | null;
  try {
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    // Utenfor synsfeltet, men fortsatt i dokumentet – utvalg krever begge deler.
    area.style.cssText = "position:fixed;top:-9999px;opacity:0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  } finally {
    hadFocus?.focus?.();
  }
}
