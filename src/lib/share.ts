/**
 * Deling av reisemål: bruker enhetens eget delingsark der det finnes
 * (navigator.share), og kopierer lenken som utfall der det ikke gjør.
 * Ingen tredjeparts knapper, ingen sporing – delingen skjer i telefonen.
 */

export type ShareResult = "shared" | "copied" | "failed";

export async function shareDestination(opts: { title: string; text: string; path: string }): Promise<ShareResult> {
  const url = `${window.location.origin}${opts.path}`;
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({ title: opts.title, text: opts.text, url });
      return "shared";
    }
  } catch (err) {
    // Brukeren avbrøt arket selv – det er ikke en feil.
    if (err instanceof DOMException && err.name === "AbortError") return "failed";
  }
  try {
    await navigator.clipboard.writeText(url);
    return "copied";
  } catch {
    return "failed";
  }
}
