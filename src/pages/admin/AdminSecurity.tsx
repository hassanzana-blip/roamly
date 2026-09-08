import { useState } from "react";
import { Check, Copy, KeyRound, ShieldAlert, ShieldCheck, Smartphone } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { cn } from "@/lib/utils";
import { copyText } from "@/lib/clipboard";

/**
 * Totrinn, slått på av den som eier kontoen.
 *
 * Tre steg, i den rekkefølgen de faktisk gir mening: skann, bekreft, ta vare
 * på gjenopprettingskodene. Kodene vises én gang – serveren lagrer bare
 * hashen, så ingen, heller ikke vi, kan hente dem fram igjen.
 */

const inputCls =
  "t-num w-full min-h-12 rounded-xl border border-input bg-white px-4 py-3 text-center text-2xl tracking-[0.3em] text-night outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30";

function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<"idle" | "ok" | "failed">("idle");
  return (
    <button
      type="button"
      onClick={() => {
        void copyText(text).then((ok) => {
          // Koder man tror man har kopiert, men ikke har, er verre enn ingen
          // knapp. Si det rett ut når nettleseren nekter.
          setState(ok ? "ok" : "failed");
          window.setTimeout(() => setState("idle"), ok ? 1600 : 4000);
        });
      }}
      aria-live="polite"
      className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 text-sm font-semibold hover:border-foreground/40"
    >
      {state === "ok" ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
      {state === "ok" ? "Kopiert" : state === "failed" ? "Kopier selv – nettleseren nektet" : label}
    </button>
  );
}

export default function AdminSecurity() {
  const utils = trpc.useUtils();
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const [setup, setSetup] = useState<{ uri: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  const start = trpc.staffAuth.startMfaSetup.useMutation({
    onSuccess: (res) => {
      setSetup(res);
      setError(null);
    },
    onError: (e) => setError(humanMessage(e)),
  });
  const confirm = trpc.staffAuth.confirmMfaSetup.useMutation({
    onSuccess: (res) => {
      setCodes(res.recoveryCodes);
      setSetup(null);
      setCode("");
      setError(null);
      void utils.staffAuth.me.invalidate();
    },
    onError: (e) => setError(humanMessage(e)),
  });
  const disable = trpc.staffAuth.disableMfa.useMutation({
    onSuccess: () => {
      setPassword("");
      setError(null);
      void utils.staffAuth.me.invalidate();
    },
    onError: (e) => setError(humanMessage(e)),
  });

  const on = me.data?.authenticated && me.data.mfaEnabled;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="t-h1">Sikkerhet</h1>
      <p className="t-lead mt-2 text-muted-foreground">Kontoen din åpner refusjoner, kundedata og passopplysninger. Et passord alene er tynt.</p>

      <section className="mt-8 rounded-2xl border border-border bg-card p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", on ? "bg-success/10 text-success" : "bg-warning/10 text-warning")}>
            {on ? <ShieldCheck className="size-5" aria-hidden="true" /> : <ShieldAlert className="size-5" aria-hidden="true" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="t-h3">Totrinnspålogging</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {on ? "På. Innlogging krever en kode fra autentikator-appen din." : "Av. Hvem som helst med passordet ditt kommer inn."}
            </p>
          </div>
        </div>

        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        {/* Kodene, én gang. */}
        {codes && (
          <div className="mt-5 rounded-xl border border-success/40 bg-success/5 p-4">
            <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <KeyRound className="size-4" aria-hidden="true" /> Gjenopprettingskoder
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Skriv dem ned nå. De vises aldri igjen, og hver kode virker én gang. Uten dem er en mistet telefon en mistet konto.
            </p>
            <ul className="t-num mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              {codes.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-2">
              <CopyButton text={codes.join("\n")} label="Kopier alle" />
              <button type="button" onClick={() => setCodes(null)} className="inline-flex min-h-11 items-center rounded-lg bg-night px-4 text-sm font-semibold text-white">
                Jeg har lagret dem
              </button>
            </div>
          </div>
        )}

        {!on && !setup && !codes && (
          <button
            type="button"
            onClick={() => start.mutate()}
            disabled={start.isPending}
            className="mt-5 inline-flex min-h-12 items-center gap-2 rounded-xl bg-primary px-5 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
          >
            <Smartphone className="size-4" aria-hidden="true" />
            {start.isPending ? "Forbereder …" : "Slå på totrinn"}
          </button>
        )}

        {setup && (
          <div className="mt-5 space-y-4">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-night text-[12px] font-bold text-white">1</span>
                <span>
                  Åpne autentikator-appen din og legg til en konto manuelt. Lim inn nøkkelen under – eller hele adressen, hvis appen tar imot den.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-night text-[12px] font-bold text-white">2</span>
                <span>Skriv den sekssifrede koden appen viser.</span>
              </li>
            </ol>

            <div className="rounded-xl border border-border bg-muted/40 p-4">
              <p className="eyebrow">Nøkkel</p>
              <p className="t-code mt-1 break-all text-sm">{setup.secret}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton text={setup.secret} label="Kopier nøkkel" />
                <CopyButton text={setup.uri} label="Kopier adresse" />
              </div>
            </div>

            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                confirm.mutate({ code: code.trim() });
              }}
            >
              <label htmlFor="totp-confirm" className="block text-sm font-semibold">
                Koden fra appen
              </label>
              <input id="totp-confirm" value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={inputCls} />
              <button
                type="submit"
                disabled={confirm.isPending || code.trim().length < 6}
                className="w-full min-h-12 rounded-xl bg-primary px-4 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
              >
                {confirm.isPending ? "Bekrefter …" : "Bekreft og slå på"}
              </button>
            </form>
          </div>
        )}

        {on && (
          <form
            className="mt-5 space-y-3 border-t border-border pt-5"
            onSubmit={(e) => {
              e.preventDefault();
              disable.mutate({ password });
            }}
          >
            <p className="text-sm font-semibold">Slå av totrinn</p>
            <p className="text-sm text-muted-foreground">Krever passordet ditt og en fersk innlogging. Gjenopprettingskodene slettes.</p>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="Passordet ditt"
              className="w-full min-h-12 rounded-xl border border-input bg-white px-4 text-base text-night outline-none focus:border-primary"
            />
            <button
              type="submit"
              disabled={disable.isPending || password.length === 0}
              className="min-h-11 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              {disable.isPending ? "Slår av …" : "Slå av"}
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
