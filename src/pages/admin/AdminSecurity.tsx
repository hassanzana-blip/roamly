import { useState } from "react";
import { Check, Copy, KeyRound, Laptop, LogOut, Monitor, Moon, Rows3, Rows4, ShieldAlert, ShieldCheck, Smartphone, Sun } from "lucide-react";
import { useAdminPrefs, type Density, type Theme } from "@/providers/adminPrefsContext";
import { deviceLabel } from "@/lib/deviceLabel";
import { formatDateTime } from "./helpers";
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

      <Sessions />
      <Appearance />
    </div>
  );
}

/* ── Hvor du er logget inn ───────────────────────────────────────────────── */

function Sessions() {
  const utils = trpc.useUtils();
  const list = trpc.staffAuth.mySessions.useQuery(undefined, { retry: false });
  const signOut = trpc.staffAuth.signOutOtherSessions.useMutation({
    onSuccess: () => void utils.staffAuth.mySessions.invalidate(),
  });
  const others = (list.data ?? []).filter((s) => !s.current).length;

  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="t-h3">Hvor du er logget inn</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Kjenner du ikke igjen en av dem, logg ut de andre og bytt passord. Listen viser bare dine egne innlogginger.
      </p>

      {list.isLoading ? (
        <p className="mt-4 text-sm text-muted-foreground">Laster …</p>
      ) : list.error || !list.data ? (
        <p role="alert" className="mt-4 text-sm text-destructive">{humanMessage(list.error)}</p>
      ) : (
        <>
          <ul className="mt-4 divide-y divide-border">
            {list.data.map((s) => (
              <li key={s.id} className="flex items-start gap-3 py-3">
                <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
                  <Laptop className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                    {deviceLabel(s.userAgent)}
                    {s.current && (
                      <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">Denne skjermen</span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    {s.ip ?? "ukjent adresse"} · sist aktiv {formatDateTime(s.lastSeenAt)}
                  </p>
                </div>
              </li>
            ))}
          </ul>

          {others > 0 && (
            <button
              type="button"
              onClick={() => signOut.mutate()}
              disabled={signOut.isPending}
              className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50"
            >
              <LogOut className="size-4" aria-hidden="true" />
              {signOut.isPending ? "Logger ut …" : others === 1 ? "Logg ut den andre" : `Logg ut de ${others} andre`}
            </button>
          )}
        </>
      )}
    </section>
  );
}

/* ── Utseende ────────────────────────────────────────────────────────────── */

function Choice<T extends string>({
  label, value, current, onSelect, icon: Icon,
}: { label: string; value: T; current: T; onSelect: (v: T) => void; icon: typeof Sun }) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      aria-pressed={active}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
        // `bg-night` er nesten kortfargen i mørkt tema, så et valgt felt ville
        // sett like uvalgt ut som de andre. `bg-foreground` snur riktig vei i
        // begge temaer og er alltid det tydeligste feltet på skjermen.
        active ? "border-foreground bg-foreground text-background" : "border-border text-foreground hover:border-foreground/40",
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Appearance() {
  const { theme, density, setTheme, setDensity } = useAdminPrefs();
  return (
    <section className="mt-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="t-h3">Utseende</h2>
      <p className="mt-1 text-sm text-muted-foreground">Gjelder denne maskinen, ikke kontoen din.</p>

      <div className="mt-5">
        <p className="eyebrow">Tema</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Choice<Theme> label="Følg systemet" value="system" current={theme} onSelect={setTheme} icon={Monitor} />
          <Choice<Theme> label="Lyst" value="light" current={theme} onSelect={setTheme} icon={Sun} />
          <Choice<Theme> label="Mørkt" value="dark" current={theme} onSelect={setTheme} icon={Moon} />
        </div>
      </div>

      <div className="mt-5">
        <p className="eyebrow">Tetthet i lister</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <Choice<Density> label="Luftig" value="comfortable" current={density} onSelect={setDensity} icon={Rows3} />
          <Choice<Density> label="Tett" value="compact" current={density} onSelect={setDensity} icon={Rows4} />
        </div>
        <p className="mt-2 text-[13px] text-muted-foreground">
          Tett gir flere rader på skjermen. Trykkflatene blir ikke mindre – bare luften rundt teksten.
        </p>
      </div>
    </section>
  );
}
