import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import SkyMark from "@/components/brand/SkyMark";
import { trpc } from "@/providers/trpc";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { RecoveryCodes } from "./RecoveryCodes";

type Step = "password" | "totp" | "done";

const inputCls =
  "w-full min-h-12 rounded-xl border border-input bg-white px-4 py-3 text-base text-night outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/70";
const btnCls =
  "w-full min-h-12 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 disabled:opacity-50";

export default function AdminActivate() {
  usePageMeta({ ...PAGE_META.admin, title: "Aktiver konto" });
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const reduce = useReducedMotion();

  const [step, setStep] = useState<Step>("password");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [setup, setSetup] = useState<{ qrDataUrl: string; otpauthUri: string; email: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const begin = trpc.staffAuth.beginActivation.useMutation({
    onSuccess: (r) => { setError(null); setSetup(r); setStep("totp"); },
    onError: (err) => setError(err.message),
  });
  const complete = trpc.staffAuth.completeActivation.useMutation({
    onSuccess: (r) => { setError(null); setRecoveryCodes(r.recoveryCodes); setStep("done"); },
    onError: (err) => setError(err.message),
  });

  if (!token) {
    return (
      <main id="main" className="grid min-h-screen place-items-center bg-night px-4 text-center">
        <div className="max-w-md rounded-3xl bg-card p-8">
          <h1 className="font-display text-2xl">Ugyldig lenke</h1>
          <p className="mt-3 text-sm text-muted-foreground">Aktiveringslenken mangler eller er feil. Be om en ny invitasjon.</p>
        </div>
      </main>
    );
  }

  return (
    <div className="grid min-h-screen place-items-center bg-night px-4 py-10">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.15 : 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <SkyMark className="mx-auto h-10 w-10 text-white" />
          <p className="mt-2 text-sm text-white/70">Aktiver kontoen din</p>
        </div>

        <ol className="mb-5 flex items-center justify-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-white/60" aria-label="Fremdrift">
          {(["password", "totp", "done"] as Step[]).map((s, i) => (
            <li key={s} className={`rounded-full px-2.5 py-1 ${step === s ? "bg-primary text-primary-foreground" : ""}`}>
              {i + 1}. {s === "password" ? "Passord" : s === "totp" ? "Autentikator" : "Ferdig"}
            </li>
          ))}
        </ol>

        <main id="main" className="rounded-3xl bg-card p-6 shadow-2xl sm:p-8">
          {step === "password" && (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl">
                <KeyRound className="h-5 w-5 text-primary" aria-hidden="true" /> Velg passord
              </h1>
              <p className="mt-2 text-sm text-muted-foreground">Minst 12 tegn med store og små bokstaver og tall. Deretter setter du opp totrinnsbekreftelse.</p>
              <form
                className="mt-6 space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (password !== password2) { setError("Passordene er ikke like."); return; }
                  begin.mutate({ token, password });
                }}
              >
                <div>
                  <label htmlFor="pw1" className="mb-1.5 block text-sm font-semibold text-foreground">Nytt passord</label>
                  <input id="pw1" type="password" autoComplete="new-password" required minLength={12} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label htmlFor="pw2" className="mb-1.5 block text-sm font-semibold text-foreground">Gjenta passordet</label>
                  <input id="pw2" type="password" autoComplete="new-password" required minLength={12} value={password2} onChange={(e) => setPassword2(e.target.value)} className={inputCls} />
                </div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                <button type="submit" disabled={begin.isPending} className={btnCls}>{begin.isPending ? "Lagrer …" : "Fortsett"}</button>
              </form>
            </>
          )}

          {step === "totp" && setup && (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl">
                <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> Sett opp autentikator
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Skann QR-koden i en autentikator-app (1Password, Google Authenticator, Authy …) for <strong className="text-foreground">{setup.email}</strong>, og skriv inn koden appen viser.
              </p>
              <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); complete.mutate({ token, totpCode: code.trim() }); }}>
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4">
                  <img src={setup.qrDataUrl} alt={`QR-kode for TOTP-oppsett for ${setup.email}`} width={240} height={240} className="h-60 w-60" />
                  <details className="w-full text-xs text-muted-foreground">
                    <summary className="cursor-pointer font-semibold text-foreground">Kan du ikke skanne? Vis nøkkelen</summary>
                    <p className="mt-2 select-all break-all rounded-lg bg-muted px-3 py-2 font-mono">{setup.otpauthUri}</p>
                  </details>
                </div>
                <div>
                  <label htmlFor="totp" className="mb-1.5 block text-sm font-semibold text-foreground">Kode fra appen</label>
                  <input id="totp" inputMode="numeric" autoComplete="one-time-code" autoFocus required minLength={6} maxLength={8} value={code} onChange={(e) => setCode(e.target.value)} className={inputCls + " text-center text-xl tracking-[0.3em]"} placeholder="000000" />
                </div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                <button type="submit" disabled={complete.isPending} className={btnCls}>{complete.isPending ? "Aktiverer …" : "Aktiver kontoen"}</button>
              </form>
            </>
          )}

          {step === "done" && (
            <div>
              <div className="text-center">
                <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" aria-hidden="true" />
                <h1 className="mt-4 font-display text-2xl">Kontoen er klar!</h1>
              </div>
              <div className="mt-5">
                <RecoveryCodes codes={recoveryCodes} filename="hellosky-gjenopprettingskoder.txt" />
              </div>
              <Link to="/admin/logg-inn" className="mt-6 block w-full rounded-xl bg-primary px-4 py-3.5 text-center font-bold text-primary-foreground transition-all hover:brightness-110">
                Jeg har lagret kodene – gå til innlogging
              </Link>
            </div>
          )}
        </main>
      </motion.div>
    </div>
  );
}
