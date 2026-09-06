// Penger håndteres som desimal-strenger — aldri flyttall.
// DB: DECIMAL(12,2). Alle beregninger går via heltalls-øre.

/** "1234.50" → 123450 (øre). Kaster ved ugyldig format. */
export function toMinor(amount: string): number {
  const m = /^-?\d+(\.\d{1,2})?$/.exec(amount.trim());
  if (!m) throw new Error(`Ugyldig beløp: ${amount}`);
  const negative = amount.trim().startsWith("-");
  const [kr, ore = ""] = amount.trim().replace("-", "").split(".");
  const minor = Number(kr) * 100 + Number((ore + "00").slice(0, 2));
  return negative ? -minor : minor;
}

/** 123450 → "1234.50" */
export function fromMinor(minor: number): string {
  const negative = minor < 0;
  const abs = Math.abs(minor);
  const kr = Math.floor(abs / 100);
  const ore = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${kr}.${ore}`;
}

export function addAmounts(...amounts: string[]): string {
  return fromMinor(amounts.reduce((sum, a) => sum + toMinor(a), 0));
}

export function multiplyAmount(amount: string, factor: number): string {
  if (!Number.isInteger(factor)) throw new Error("Faktor må være heltall");
  return fromMinor(toMinor(amount) * factor);
}
