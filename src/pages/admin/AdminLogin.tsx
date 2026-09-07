import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { motion, useReducedMotion } from "motion/react";
import { Eye, EyeOff, LockKeyhole, Rocket, ShieldCheck } from "lucide-react";
import SkyMark from "@/components/brand/SkyMark";
import { trpc } from "@/providers/trpc";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { RecoveryCodes } from "./RecoveryCodes";

type Step = "credentials" | "mfa" | "setup" | "recovery";

const inputCls =
  "w-full min-h-12 rounded-xl border border-input bg-white px-4 py-3 text-base text-night outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/70";
const btnCls =
  "w-full min-h-12 rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50";

function safeNext(raw: string | null): string {
  if (!raw || !raw.startsWith("/admin") || raw.startsWith("/admin/logg-inn")) return "/admin";
  return raw;
}

export default function AdminLogin() {
  usePageMeta({ ...PAGE_META.admin, title: "Logg inn" });
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const reduce = useReducedMotion();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [step, setStep] = useState<Step>("credentials");
  const [error, setError] = useState<string | null>(null);
  const [setupName, setSetupName] = useState("");
  const [setup, setSetup] = useState<{ qrDataUrl: string; otpauthUri: string; email: string } | null>(null);
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  const utils = trpc.useUtils();
  const setupStatus = trpc.staffAuth.setupStatus.useQuery(undefined, { staleTime: 30_000, retry: false });
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false, staleTime: 0 });

  const finish = () => void utils.staffAuth.me.invalidate().then(() => navigate(next, { replace: true }));

  const beginMfaSetup = trpc.staffAuth.beginMfaSetup.useMutation({
    onSuccess: (r) => { setSetup(r); setStep("setup"); setError(null); },
    onError: (err) => setError(err.message),
  });

  // Kom inn via /admin med sesjon som mangler MFA (?mfa=1) → riktig steg direkte.
  useEffect(() => {
    if (!me.data?.authenticated) return;
    if (me.data.mfaSetupRequired) {
      if (step === "credentials" && !beginMfaSetup.isPending && !setup) beginMfaSetup.mutate();
    } else if (!me.data.mfaVerified) {
      if (step === "credentials") setStep("mfa");
    } else if (params.get("mfa") !== "1") {
      navigate(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me.data]);

  const claimOwner = trpc.staffAuth.claimFirstOwner.useMutation({
    onSuccess: (res) => navigate(res.setupPath),
    onError: (err) => setError(err.message),
  });

  const login = trpc.staffAuth.login.useMutation({
    onSuccess: (res) => {
      setError(null);
      if (res.mfaRequired) setStep("mfa");
      else if (res.mfaSetupRequired) beginMfaSetup.mutate();
      else finish();
    },
    onError: (err) => setError(err.message),
  });

  const verifyMfa = trpc.staffAuth.verifyMfa.useMutation({
    onSuccess: finish,
    onError: (err) => setError(err.message),
  });

  const completeMfaSetup = trpc.staffAuth.completeMfaSetup.useMutation({
    onSuccess: (r) => { setRecoveryCodes(r.recoveryCodes); setStep("recovery"); setError(null); },
    onError: (err) => setError(err.message),
  });

  const title =
    step === "credentials" ? "Logg inn" : step === "mfa" ? "Totrinnsbekreftelse" : step === "setup" ? "Sett opp totrinnsbekreftelse" : "Gjenopprettingskoder";

  return (
    <div className="grid min-h-screen place-items-center bg-night px-4 py-8">
      <motion.div
        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0.15 : 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <SkyMark className="mx-auto h-10 w-10 text-white" />
          <p className="mt-2 text-sm text-white/70">Internportal for ansatte</p>
        </div>

        <main id="main" className="rounded-3xl bg-card p-6 shadow-2xl sm:p-8">
          {setupStatus.data?.needsSetup && step === "credentials" ? (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl text-foreground">
                <Rocket className="h-5 w-5 text-primary" aria-hidden="true" /> Førstegangsoppsett
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                Det finnes ingen ansattkontoer i dette miljøet ennå. Opprett den første eierkontoen — du får en engangslenke for å sette passord og autentikator.
              </p>
              <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); claimOwner.mutate({ email, name: setupName }); }}>
                <div>
                  <label htmlFor="setup-name" className="mb-1.5 block text-sm font-semibold text-foreground">Navn</label>
                  <input id="setup-name" type="text" autoComplete="name" required value={setupName} onChange={(e) => setSetupName(e.target.value)} className={inputCls} placeholder="Ditt navn" />
                </div>
                <div>
                  <label htmlFor="setup-email" className="mb-1.5 block text-sm font-semibold text-foreground">E-post</label>
                  <input id="setup-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="deg@hellosky.no" />
                </div>
                {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                <button type="submit" disabled={claimOwner.isPending} className={btnCls}>{claimOwner.isPending ? "Oppretter …" : "Opprett eierkonto"}</button>
                <p className="text-xs leading-relaxed text-muted-foreground">Denne muligheten forsvinner automatisk så snart første konto er opprettet. All aktivitet logges.</p>
              </form>
            </>
          ) : (
            <>
              <h1 className="flex items-center gap-2.5 font-display text-2xl text-foreground">
                {step === "setup" || step === "recovery" ? <ShieldCheck className="h-5 w-5 text-primary" aria-hidden="true" /> : <LockKeyhole className="h-5 w-5 text-primary" aria-hidden="true" />}
                {title}
              </h1>

              {step === "credentials" && (
                <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); login.mutate({ email, password }); }}>
                  <div>
                    <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">E-post</label>
                    <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="deg@hellosky.no" />
                  </div>
                  <div>
                    <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">Passord</label>
                    <div className="relative">
                      <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls + " pr-14"} placeholder="••••••••••••" />
                      <button type="button" onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Skjul passord" : "Vis passord"} aria-pressed={showPassword} className="absolute right-1.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground">
                        {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
                      </button>
                    </div>
                  </div>
                  {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                  <button type="submit" disabled={login.isPending || beginMfaSetup.isPending} className={btnCls}>{login.isPending ? "Logger inn …" : "Logg inn"}</button>
                </form>
              )}

              {step === "mfa" && (
                <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); verifyMfa.mutate({ code: mfaCode.trim() }); }}>
                  <p className="text-sm text-muted-foreground">Skriv inn koden fra autentikator-appen din, eller en av gjenopprettingskodene dine.</p>
                  <div>
                    <label htmlFor="mfa" className="mb-1.5 block text-sm font-semibold text-foreground">Kode</label>
                    <input id="mfa" inputMode="numeric" autoComplete="one-time-code" autoFocus required value={mfaCode} onChange={(e) => setMfaCode(e.target.value)} className={inputCls + " text-center text-xl tracking-[0.3em]"} placeholder="000000" />
                  </div>
                  {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                  <button type="submit" disabled={verifyMfa.isPending} className={btnCls}>{verifyMfa.isPending ? "Bekrefter …" : "Bekreft"}</button>
                  <button type="button" onClick={() => { setStep("credentials"); setError(null); }} className="min-h-11 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground">← Tilbake</button>
                </form>
              )}

              {step === "setup" && (
                <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); completeMfaSetup.mutate({ code: setupCode.trim() }); }}>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    Kontoen din krever totrinnsbekreftelse. Skann QR-koden i en autentikator-app (1Password, Google Authenticator, Authy …) og skriv inn koden appen viser.
                  </p>
                  {setup ? (
                    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-4">
                      <img src={setup.qrDataUrl} alt={`QR-kode for TOTP-oppsett for ${setup.email}`} width={240} height={240} className="h-60 w-60" />
                      <details className="w-full text-xs text-muted-foreground">
                        <summary className="cursor-pointer font-semibold text-foreground">Kan du ikke skanne? Vis nøkkelen</summary>
                        <p className="mt-2 select-all break-all rounded-lg bg-muted px-3 py-2 font-mono">{setup.otpauthUri}</p>
                      </details>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Genererer nøkkel …</p>
                  )}
                  <div>
                    <label htmlFor="setup-code" className="mb-1.5 block text-sm font-semibold text-foreground">Kode fra appen</label>
                    <input id="setup-code" inputMode="numeric" autoComplete="one-time-code" required minLength={6} maxLength={8} value={setupCode} onChange={(e) => setSetupCode(e.target.value)} className={inputCls + " text-center text-xl tracking-[0.3em]"} placeholder="000000" />
                  </div>
                  {error && <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">{error}</p>}
                  <button type="submit" disabled={completeMfaSetup.isPending || !setup} className={btnCls}>{completeMfaSetup.isPending ? "Aktiverer …" : "Aktiver totrinnsbekreftelse"}</button>
                  {!setup && !beginMfaSetup.isPending && (
                    <button type="button" onClick={() => beginMfaSetup.mutate()} className="min-h-11 w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground">Prøv å generere på nytt</button>
                  )}
                </form>
              )}

              {step === "recovery" && (
                <div className="mt-6 space-y-4">
                  <RecoveryCodes codes={recoveryCodes} filename="hellosky-gjenopprettingskoder.txt" />
                  <button type="button" onClick={finish} className={btnCls}>Jeg har lagret kodene – fortsett</button>
                </div>
              )}
            </>
          )}
        </main>

        <p className="mt-6 text-center text-xs text-white/60">All aktivitet logges. Kun autorisert personell.</p>
      </motion.div>
    </div>
  );
}
