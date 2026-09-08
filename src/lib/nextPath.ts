/**
 * «Hvor skal du etterpå?» fra en lenke, gjort trygg.
 *
 * `?next=` kommer fra adressefeltet og kan peke hvor som helst. To grunner til
 * å begrense den: et betalingsnettsted skal aldri kunne lokkes til å sende en
 * innlogget kunde videre til et fremmed domene, og en verdi appen ikke kan
 * navigere til (`//example.com`, `https://…`) etterlater kunden stående på
 * innloggingssiden uten vei videre.
 *
 * Godtatt: én sti innenfor appen. Alt annet faller tilbake.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/profil"): string {
  if (!raw) return fallback;
  const value = raw.trim();
  if (!value.startsWith("/")) return fallback; // absolutt URL eller relativ sti
  if (value.startsWith("//") || value.startsWith("/\\")) return fallback; // protokoll-relativ
  // Kontrolltegn og linjeskift hører ikke hjemme i en sti.
  if ([...value].some((ch) => ch.codePointAt(0)! < 0x20 || ch.codePointAt(0) === 0x7f)) return fallback;
  try {
    // Løses opp mot en fast opprinnelse: peker den ut av appen, er den ikke vår.
    const url = new URL(value, "https://hellosky.invalid");
    if (url.origin !== "https://hellosky.invalid") return fallback;
    return `${url.pathname}${url.search}${url.hash}` || fallback;
  } catch {
    return fallback;
  }
}
