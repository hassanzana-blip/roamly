import { Component, type ErrorInfo, type ReactNode } from "react";

/**
 * ErrorBoundary – fanger render-feil i rutetreet og viser en vennlig norsk
 * feilside med «Last siden på nytt». Klassekomponent (React krever det).
 * Bevisst uten avhengigheter til router/i18n slik at den fungerer selv om
 * disse er årsaken til feilen.
 */

type Props = { children: ReactNode; fallback?: ReactNode };
type State = { error: Error | null };

const CHUNK_ERROR_RE = /Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const RELOAD_FLAG = "hs:chunk-reload";

/**
 * Etter en deploy peker en åpen fane på chunk-filer som ikke finnes lenger, og
 * neste navigasjon feiler. Én automatisk omlasting henter den nye versjonen;
 * flagget i sessionStorage hindrer en evig løkke hvis feilen er noe annet.
 * Returnerer true når omlasting er satt i gang.
 */
export function reloadOnceForStaleChunk(message: string): boolean {
  if (!CHUNK_ERROR_RE.test(message) || typeof window === "undefined") return false;
  try {
    if (sessionStorage.getItem(RELOAD_FLAG)) return false;
    sessionStorage.setItem(RELOAD_FLAG, String(Date.now()));
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

/** Kalles når appen har startet fint, slik at neste deploy også får sin ene omlasting. */
export function clearStaleChunkFlag() {
  try {
    const at = Number(sessionStorage.getItem(RELOAD_FLAG) ?? 0);
    // Behold flagget i ett minutt: en omlasting som feiler igjen skal vise feilsiden, ikke snurre.
    if (at && Date.now() - at > 60_000) sessionStorage.removeItem(RELOAD_FLAG);
  } catch {
    /* privat modus uten lagring – ingen ting å rydde */
  }
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Ingen ekstern feilrapportering konfigurert ennå – logg lokalt.
    console.error("[ErrorBoundary]", error, info.componentStack);
    reloadOnceForStaleChunk(error.message);
  }

  private reload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    const lang = typeof document !== "undefined" ? document.documentElement.lang : "nb";
    const en = lang.startsWith("en");
    const isChunkError = CHUNK_ERROR_RE.test(this.state.error.message);

    return (
      <main
        id="main"
        role="alert"
        className="grid min-h-[100dvh] place-items-center bg-background p-6 text-center text-foreground"
      >
        <div className="max-w-md">
          <p className="font-mono-label text-[12px] text-muted-foreground">HelloSky</p>
          <h1 className="mt-3 font-display text-3xl tracking-tight">
            {en ? "Something went wrong" : "Noe gikk galt"}
          </h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
            {isChunkError
              ? en
                ? "A new version of HelloSky has been published. Reload the page to continue."
                : "En ny versjon av HelloSky er publisert. Last siden på nytt for å fortsette."
              : en
                ? "We could not display this page. Try reloading – if it keeps happening, contact customer service."
                : "Vi klarte ikke å vise denne siden. Prøv å laste den på nytt – hvis det fortsetter, kontakt kundeservice."}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={this.reload}
              className="inline-flex min-h-12 items-center rounded-lg bg-primary px-7 text-[15px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              {en ? "Reload the page" : "Last siden på nytt"}
            </button>
            <a
              href="/"
              className="inline-flex min-h-12 items-center rounded-lg border border-border px-7 text-[15px] font-semibold transition-colors hover:bg-muted"
            >
              {en ? "To the front page" : "Til forsiden"}
            </a>
          </div>
        </div>
      </main>
    );
  }
}
