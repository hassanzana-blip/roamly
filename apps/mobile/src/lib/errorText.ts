import type { I18n } from "../i18n";
import type { ErrorKey } from "../i18n/ns/errors";
import { ApiError, CLIENT_ERROR_CODES } from "./api";

/**
 * En feil som tekst på brukerens språk. Serverens koder er stabile og ment for
 * oversettelse her. På norsk brukes serverens egen kundetekst når den finnes
 * (den er skrevet for kunder og er ofte mer presis); på engelsk teksten for
 * koden. `overrides` gir en presis tekst for en kode i en bestemt sammenheng,
 * f.eks. UNAUTHORIZED ved innlogging = feil e-post eller passord.
 */
export function errorText(err: unknown, { locale, t }: Pick<I18n, "locale" | "t">, overrides?: Partial<Record<string, string>>): string {
  if (!(err instanceof ApiError)) return t.errors.generic;
  const override = overrides?.[err.code];
  if (override) return override;
  const fromServer = !(CLIENT_ERROR_CODES as readonly string[]).includes(err.code) && err.code !== "INTERNAL";
  if (locale === "nb" && fromServer && err.message.trim()) return err.message;
  return (t.errors as Record<string, string>)[err.code as ErrorKey] ?? t.errors.generic;
}
