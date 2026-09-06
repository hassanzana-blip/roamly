import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion } from "motion/react";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import RoamlyMark from "@/components/brand/RoamlyMark";
import { trpc } from "@/providers/trpc";

type Step = "password" | "mfa" | "done";

export default function AdminActivate() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [totpCode, setTotpCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const begin = trpc.staffAuth.beginActivation.useMutation({
    onSuccess: (res) => {
      setError(null);
      setQrDataUrl(res.qrDataUrl);
      setStep("mfa");
    },
    onError: (err) => setError(err.message),
  });

  const complete = trpc.staffAuth.completeActivation.useMutation({
    onSuccess: (res) => {
      setError(null);
      setRecoveryCodes(res.recoveryCodes);
      setStep("done");
    },
    onError: (err) => setError(err.message),
  });

  const inputCls =
    "w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60";

  if (!token) {
    return (
      <div className="grid min-h-screen place-items-center bg-night px-4 text-center">
        <div className="max-w-md rounded-3xl bg-card p-8">
          <h1 className="font-display text-2xl">Ugyldig lenke</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Aktiveringslenken mangler eller er feil. Be om en ny invitasjon.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-night px-4 py-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <RoamlyMark className="mx-auto text-3xl text-white" />
          <p className="mt-2 text-sm text-white/60">Aktiver kontoen din</p>
        </div>

        <div className="rounded-3xl bg-card p-8 shadow-2xl">
          {step === "password" && (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl">
                <KeyRound className="h-5 w-5 text-primary" /> Velg passord
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Minst 12 tegn med store og små bokstaver og tall.
              </p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password !== password2) {
                    setError("Passordene er ikke like.");
                    return;
                  }
                  begin.mutate({ token, password });
                }}
              >
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  placeholder="Nytt passord"
                  aria-label="Nytt passord"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={12}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={inputCls}
                  placeholder="Gjenta passordet"
                  aria-label="Gjenta passordet"
                />
                {error && (
                  <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={begin.isPending}
                  className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {begin.isPending ? "Oppretter …" : "Fortsett til totrinn"}
                </button>
              </form>
            </>
          )}

          {step === "mfa" && (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl">
                <ShieldCheck className="h-5 w-5 text-primary" /> Sett opp totrinn
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Skann QR-koden med en autentikator-app (1Password, Google
                Authenticator, Microsoft Authenticator el.l.), og skriv inn
                koden for å bekrefte.
              </p>
              {qrDataUrl && (
                <div className="mt-5 flex justify-center rounded-2xl border border-border bg-white p-4">
                  <img src={qrDataUrl} alt="QR-kode for autentikator-app" className="h-52 w-52" />
                </div>
              )}
              <form
                className="mt-5 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  complete.mutate({ token, totpCode });
                }}
              >
                <input
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={totpCode}
                  onChange={(e) => setTotpCode(e.target.value)}
                  className={inputCls + " text-center text-xl tracking-[0.3em]"}
                  placeholder="000000"
                  aria-label="Kode fra autentikator"
                />
                {error && (
                  <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={complete.isPending}
                  className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50"
                >
                  {complete.isPending ? "Bekrefter …" : "Aktiver kontoen"}
                </button>
              </form>
            </>
          )}

          {step === "done" && (
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
              <h1 className="mt-4 font-display text-2xl">Kontoen er klar!</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Dette er gjenopprettingskodene dine. Lagre dem trygt
                (passordbehandler) — de vises aldri igjen:
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-muted/60 p-4 font-mono text-sm">
                {recoveryCodes.map((c) => (
                  <span key={c} className="rounded-lg bg-white px-2 py-1.5">{c}</span>
                ))}
              </div>
              <Link
                to="/admin/logg-inn"
                className="mt-6 block w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110"
              >
                Gå til innlogging
              </Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
