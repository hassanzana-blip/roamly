import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, KeyRound, MailCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { PrimaryButton } from "@/components/app/primitives";
import SkyMark from "@/components/brand/SkyMark";
import { cn } from "@/lib/utils";
import { appCodeOf, humanMessage, retryAfterSecOf } from "@/lib/apiError";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/**
 * Innlogging og registrering for kunder – bevisst enkelt:
 * e-post ELLER telefon + passord + for-/etternavn. Ingen adresse.
 */

type Mode = "login" | "register" | "forgot" | "otp";

const inputCls =
  "w-full rounded-2xl border border-border bg-white px-4 py-3.5 text-[16px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block eyebrow">
        {label}
      </span>
      {children}
      {hint && <span className="mt-1 block text-[12px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export default function Auth() {
  usePageMeta(PAGE_META.login);
  const t = useT();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const next = params.get("next") || "/profil";
  const refCode = params.get("ref") ?? "";

  const [mode, setMode] = useState<Mode>(
    params.get("modus") === "registrer" ? "register" : "login",
  );
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [otpPhone, setOtpPhone] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!retryAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [retryAt]);
  const retryIn = retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;

  const onErr = (e: unknown) => {
    const code = appCodeOf(e);
    const sec = retryAfterSecOf(e);
    if (code === "RATE_LIMITED" && sec) setRetryAt(Date.now() + sec * 1000);
    else setRetryAt(null);
    if (code === "VALIDATION" && mode === "otp" && !otpSent) {
      const msg = humanMessage(e);
      setError(/sms/i.test(msg) ? `${msg}${t("au.usepw")}` : msg);
      return;
    }
    setError(humanMessage(e));
  };

  const me = trpc.customerAuth.me.useQuery(undefined, { retry: false });

  useEffect(() => {
    if (me.data) navigate(next, { replace: true });
  }, [me.data, navigate, next]);

  const onDone = () => {
    utils.customerAuth.me.invalidate();
    navigate(next, { replace: true });
  };

  const login = trpc.customerAuth.login.useMutation({ onSuccess: onDone, onError: onErr });
  const register = trpc.customerAuth.register.useMutation({
    onSuccess: () => {
      utils.customerAuth.me.invalidate();
      // Ny konto → 30–60 sekunders onboarding (kan hoppes over), aldri en tom profil.
      navigate("/velkommen", { replace: true });
    },
    onError: onErr,
  });
  const forgot = trpc.customerAuth.requestPasswordReset.useMutation({
    onSuccess: () => setForgotSent(true),
    onError: onErr,
  });
  const requestCode = trpc.customerAuth.requestLoginCode.useMutation({
    onSuccess: () => setOtpSent(true),
    onError: onErr,
  });
  const verifyCode = trpc.customerAuth.verifyLoginCode.useMutation({
    onSuccess: onDone,
    onError: onErr,
  });

  const pending =
    login.isPending ||
    register.isPending ||
    forgot.isPending ||
    requestCode.isPending ||
    verifyCode.isPending;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (retryIn > 0) return;
    if (mode === "register" && password.length < 10) {
      setError(t("au.pwshort"));
      return;
    }
    if (mode === "login") login.mutate({ identifier, password });
    else if (mode === "register") register.mutate({ identifier, password, firstName, lastName, referralCode: refCode || undefined });
    else if (mode === "otp") {
      if (otpSent) verifyCode.mutate({ phone: otpPhone, code: otpCode });
      else requestCode.mutate({ phone: otpPhone });
    } else forgot.mutate({ email: forgotEmail });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell bleed className="mx-auto w-full max-w-md px-5 sm:px-8">
        <div
          className="flex items-center justify-between pb-6"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <button
            onClick={() => navigate(-1)}
            aria-label={t("common.back")}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition-colors hover:bg-muted"
          >
            <Icon icon={ArrowLeft} size={20} />
          </button>
          <Link to="/" aria-label={t("topbar.home")}>
            <SkyMark className="h-7 w-auto" />
          </Link>
        </div>

        {mode !== "forgot" && (
          <>
            <h1 className="font-display text-[34px] leading-[1.05] tracking-tight">
              {mode === "login" ? (
                <>
                  {t("au.welcome")} <span className="hl">{t("au.welcome.hl")}</span>
                </>
              ) : mode === "otp" ? (
                <>
                  {t("au.otp.title")} <span className="hl">{t("au.otp.hl")}</span>
                </>
              ) : (
                <>
                  {t("au.create")} <span className="hl">{t("au.create.hl")}</span>
                </>
              )}
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              {mode === "login" ? t("au.login.sub") : mode === "otp" ? t("au.otp.sub") : t("au.register.sub")}
            </p>

            <div className="mt-6 grid grid-cols-3 rounded-full bg-muted p-1">
              {(["login", "otp", "register"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => {
                    setMode(m);
                    setError(null);
                  }}
                  aria-pressed={mode === m}
                  className={cn(
                    "min-h-11 rounded-full text-[13px] font-semibold transition-colors",
                    mode === m ? "bg-night text-white" : "text-muted-foreground",
                  )}
                >
                  {m === "login" ? t("common.login") : m === "otp" ? t("au.tab.otp") : t("au.tab.register")}
                </button>
              ))}
            </div>
          </>
        )}

        {mode === "forgot" && !forgotSent && (
          <>
            <h1 className="font-display text-[34px] leading-[1.05] tracking-tight">
              {t("au.forgot")} <span className="hl">{t("au.forgot.hl")}</span>
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">{t("au.forgot.sub")}</p>
          </>
        )}

        {mode === "forgot" && forgotSent ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Icon icon={MailCheck} size={24} className="text-foreground" />
            </span>
            <h1 className="mt-5 font-display text-[30px] leading-tight tracking-tight">
              {t("au.checkemail")}
            </h1>
            <p className="mt-2 max-w-xs text-[15px] text-muted-foreground">{t("au.forgot.sent", { email: forgotEmail })}</p>
            <PrimaryButton className="mt-8 w-full" onClick={() => setMode("login")}>
              {t("au.backtologin")}
            </PrimaryButton>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            {mode === "register" && (
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("common.first")}>
                  <input
                    autoComplete="given-name"
                    placeholder="Ola"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label={t("common.last")}>
                  <input
                    autoComplete="family-name"
                    placeholder="Nordmann"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>
              </div>
            )}

            {mode === "forgot" ? (
              <Field label={t("common.email")}>
                <input
                  type="email"
                  autoComplete="email"
                  placeholder={t("common.emailph")}
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  className={inputCls}
                  required
                />
              </Field>
            ) : mode === "otp" ? (
              <>
                <div className="flex items-center gap-3 rounded-lg bg-muted px-4 py-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary">
                    <Icon icon={KeyRound} size={20} className="text-foreground" />
                  </span>
                  <p className="text-[13px] leading-snug text-muted-foreground">
                    {t("au.otp.info")}
                  </p>
                </div>
                <Field label={t("au.phone")}>
                  <input
                    type="tel"
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="+47 900 00 000"
                    value={otpPhone}
                    onChange={(e) => setOtpPhone(e.target.value)}
                    className={inputCls}
                    disabled={otpSent}
                    required
                  />
                </Field>
                {otpSent && (
                  <Field
                    label={t("au.code")}
                    hint={t("au.code.hint", { phone: otpPhone })}
                  >
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="••••••"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ""))}
                      className={cn(inputCls, "text-center text-[22px] font-bold tracking-[0.5em]")}
                      required
                    />
                  </Field>
                )}
                {otpSent && (
                  <button
                    type="button"
                    onClick={() => {
                      setOtpSent(false);
                      setOtpCode("");
                      setError(null);
                    }}
                    className="text-[13px] font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
                  >
                    {t("au.wrongnumber")}
                  </button>
                )}
              </>
            ) : (
              <>
                <Field
                  label={t("au.identifier")}
                  hint={mode === "register" ? t("au.identifier.hint") : undefined}
                >
                  <input
                    autoComplete="username"
                    inputMode="email"
                    placeholder={t("au.identifier.ph")}
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    className={inputCls}
                    required
                  />
                </Field>
                <Field label={t("au.pw")} hint={mode === "register" ? t("au.pw.hint") : undefined}>
                  <input
                    type="password"
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={inputCls}
                    required
                    minLength={mode === "register" ? 10 : 1}
                  />
                </Field>
              </>
            )}

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
                {error}
                {retryIn > 0 && t("au.retryin", { count: retryIn })}
              </p>
            )}

            <PrimaryButton type="submit" disabled={pending || retryIn > 0} className="mt-2 w-full">
              {pending
                ? t("au.wait")
                : retryIn > 0
                  ? t("au.waits", { count: retryIn })
                  : mode === "login"
                    ? t("common.login")
                    : mode === "register"
                      ? t("au.tab.register")
                      : mode === "otp"
                        ? otpSent
                          ? t("au.submit.code")
                          : t("au.submit.sendcode")
                        : t("au.submit.reset")}
            </PrimaryButton>

            {mode === "login" && (
              <button
                type="button"
                onClick={() => {
                  setMode("forgot");
                  setError(null);
                  setForgotSent(false);
                }}
                className="mx-auto mt-1 text-[14px] font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {t("au.forgotpw")}
              </button>
            )}
            {mode === "forgot" && (
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setError(null);
                }}
                className="mx-auto mt-1 text-[14px] font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                {t("au.backtologin")}
              </button>
            )}
          </form>
        )}
      </AppShell>
    </div>
  );
}
