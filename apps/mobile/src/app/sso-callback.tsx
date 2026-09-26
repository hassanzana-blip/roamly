import { Redirect } from "expo-router";

/**
 * hellosky://sso-callback – retur-URL-en for Clerks Google-innlogging
 * (SSO_REDIRECT_URL). Normalt fanges den av innloggingsvinduet og når aldri
 * appen; kommer den likevel hit, sendes kunden til Profil i stedet for en
 * «finnes ikke»-side.
 */
export default function SsoCallback() {
  return <Redirect href="/profil" />;
}
