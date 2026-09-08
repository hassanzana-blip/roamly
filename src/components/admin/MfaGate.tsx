import { useRef, useState } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { Avatar } from "@/components/admin/Avatar";
import { humanMessage } from "@/lib/apiError";

/**
 * Andre trinn: koden fra autentikator-appen.
 *
 * Sesjonen finnes allerede når dette vises – den bærer bare ingen rettigheter
 * ennå. Serveren avviser alt annet enn denne bekreftelsen, så det er ingenting
 * å hente ved å prøve å hoppe over skjermen.
 */
export function MfaGate({ name, onVerified }: { name: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [recoveryMode, setRecoveryMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const verify = trpc.staffAuth.verifyMfa.useMutation({
    onSuccess: () => {
      setError(null);
      onVerified();
    },
    onError: (err) => {
      setError(humanMessage(err));
      setCode("");
      inputRef.current?.focus();
    },
  });

  return (
    <div className="grid min-h-screen place-items-center bg-night px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <SkyMark className="mx-auto h-10 w-10 text-white" />
          <p className="mt-2 text-sm text-white/70">Ett trinn igjen</p>
        </div>

        <main className="rounded-2xl bg-card p-6 shadow-2xl sm:p-8">
          <div className="flex items-center gap-3">
            <Avatar name={name} size={48} />
            <div>
              <h1 className="font-display text-2xl leading-tight text-foreground">Hei, {name}</h1>
              <p className="text-sm text-muted-foreground">
                {recoveryMode ? "Skriv en av gjenopprettingskodene dine." : "Skriv den sekssifrede koden fra autentikator-appen."}
              </p>
            </div>
          </div>

          <form
            className="mt-6 space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              verify.mutate({ code: code.trim() });
            }}
          >
            <div>
              <label htmlFor="mfa-code" className="mb-1.5 block text-sm font-semibold text-foreground">
                {recoveryMode ? "Gjenopprettingskode" : "Engangskode"}
              </label>
              <input
                ref={inputRef}
                id="mfa-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                inputMode={recoveryMode ? "text" : "numeric"}
                autoComplete="one-time-code"
                autoFocus
                required
                placeholder={recoveryMode ? "XXXX-XXXX" : "000000"}
                className="t-num w-full min-h-12 rounded-xl border border-input bg-white px-4 py-3 text-center text-2xl tracking-[0.3em] text-night outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30"
              />
            </div>
            {error && (
              <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={verify.isPending || code.trim().length < 6}
              className="w-full min-h-12 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
            >
              {verify.isPending ? "Sjekker …" : "Bekreft"}
            </button>
            <button
              type="button"
              onClick={() => {
                setRecoveryMode((v) => !v);
                setCode("");
                setError(null);
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              <KeyRound className="size-4" aria-hidden="true" />
              {recoveryMode ? "Bruk appen i stedet" : "Mistet telefonen? Bruk en gjenopprettingskode"}
            </button>
          </form>

          <p className="mt-6 flex items-center gap-1.5 border-t border-border pt-4 text-[12px] text-muted-foreground">
            <ShieldCheck className="size-3.5 text-success" aria-hidden="true" /> Sesjonen har ingen rettigheter før koden er bekreftet.
          </p>
        </main>
      </div>
    </div>
  );
}
