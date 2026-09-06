import { useState } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";
import RoamlyMark from "@/components/brand/RoamlyMark";
import { trpc } from "@/providers/trpc";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [mfaCode, setMfaCode] = useState("");
  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [error, setError] = useState<string | null>(null);

  const utils = trpc.useUtils();

  const login = trpc.staffAuth.login.useMutation({
    onSuccess: (res) => {
      setError(null);
      if (res.mfaRequired) setStep("mfa");
      else void utils.staffAuth.me.invalidate().then(() => navigate("/admin"));
    },
    onError: (err) => setError(err.message),
  });

  const verifyMfa = trpc.staffAuth.verifyMfa.useMutation({
    onSuccess: () => void utils.staffAuth.me.invalidate().then(() => navigate("/admin")),
    onError: (err) => setError(err.message),
  });

  const inputCls =
    "w-full rounded-xl border border-input bg-white px-4 py-3 text-base outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/30 placeholder:text-muted-foreground/60";

  return (
    <div className="grid min-h-screen place-items-center bg-night px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="mb-8 text-center">
          <RoamlyMark className="mx-auto text-3xl text-white" />
          <p className="mt-2 text-sm text-white/60">Internportal for ansatte</p>
        </div>

        <div className="rounded-3xl bg-card p-8 shadow-2xl">
          <h1 className="flex items-center gap-2.5 font-display text-2xl text-foreground">
            <LockKeyhole className="h-5 w-5 text-primary" />
            {step === "credentials" ? "Logg inn" : "Totrinnsbekreftelse"}
          </h1>

          {step === "credentials" ? (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                login.mutate({ email, password });
              }}
            >
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold text-foreground">
                  E-post
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputCls}
                  placeholder="deg@roamly.no"
                />
              </div>
              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-semibold text-foreground">
                  Passord
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls + " pr-12"}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Skjul passord" : "Vis passord"}
                    className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={login.isPending}
                className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                {login.isPending ? "Logger inn …" : "Logg inn"}
              </button>
            </form>
          ) : (
            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                verifyMfa.mutate({ code: mfaCode });
              }}
            >
              <p className="text-sm text-muted-foreground">
                Skriv inn koden fra autentikator-appen din, eller en av
                gjenopprettingskodene dine.
              </p>
              <div>
                <label htmlFor="mfa" className="mb-1.5 block text-sm font-semibold text-foreground">
                  Kode
                </label>
                <input
                  id="mfa"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  required
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  className={inputCls + " text-center text-xl tracking-[0.3em]"}
                  placeholder="000000"
                />
              </div>
              {error && (
                <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                  {error}
                </p>
              )}
              <button
                type="submit"
                disabled={verifyMfa.isPending}
                className="w-full rounded-xl bg-primary px-4 py-3.5 font-bold text-primary-foreground transition-all hover:brightness-110 active:scale-[0.99] disabled:opacity-50"
              >
                {verifyMfa.isPending ? "Bekrefter …" : "Bekreft"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("credentials"); setError(null); }}
                className="w-full text-center text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                ← Tilbake
              </button>
            </form>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-white/40">
          All aktivitet logges. Kun autorisert personell.
        </p>
      </motion.div>
    </div>
  );
}
