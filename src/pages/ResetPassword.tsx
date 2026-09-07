import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { CheckCircle2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import AppShell from "@/components/app/AppShell";
import Icon from "@/components/app/Icon";
import { PrimaryButton } from "@/components/app/primitives";
import SkyMark from "@/components/brand/SkyMark";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";

/** Velg nytt passord via lenken fra e-posten (/tilbakestill-passord?token=…). */
export default function ResetPassword() {
  usePageMeta(PAGE_META.resetPassword);
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const token = params.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const reset = trpc.customerAuth.resetPassword.useMutation({
    onSuccess: () => {
      utils.customerAuth.me.invalidate();
      setDone(true);
      setTimeout(() => navigate("/profil", { replace: true }), 1600);
    },
    onError: (e) => setError(humanMessage(e)),
  });

  const inputCls =
    "w-full rounded-2xl border border-border bg-white px-4 py-3.5 text-[16px] outline-none transition-colors placeholder:text-muted-foreground/60 focus:border-foreground/40";

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError("Passordet må være minst 10 tegn.");
      return;
    }
    if (password !== password2) {
      setError("Passordene er ikke like.");
      return;
    }
    reset.mutate({ token, password });
  };

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-md">
        <div
          className="flex items-center justify-center pb-8"
          style={{ paddingTop: "max(16px, env(safe-area-inset-top))" }}
        >
          <Link to="/" aria-label="HelloSky hjem">
            <SkyMark className="h-7 w-auto" />
          </Link>
        </div>

        {done ? (
          <div className="mt-10 flex flex-col items-center text-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Icon icon={CheckCircle2} size={24} className="text-foreground" />
            </span>
            <h1 className="mt-5 font-display text-[30px] leading-tight tracking-tight">
              Passordet er endret
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Du er nå logget inn – vi tar deg videre til profilen din.
            </p>
          </div>
        ) : !token ? (
          <div className="mt-10 text-center">
            <h1 className="font-display text-[30px] leading-tight tracking-tight">
              Ugyldig lenke
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Lenken mangler eller er ufullstendig. Be om en ny tilbakestillingslenke.
            </p>
            <PrimaryButton className="mt-8" onClick={() => navigate("/logg-inn")}>
              Til innlogging
            </PrimaryButton>
          </div>
        ) : (
          <>
            <h1 className="font-display text-[34px] leading-[1.05] tracking-tight">
              Velg nytt <span className="hl">passord</span>
            </h1>
            <p className="mt-2 text-[15px] text-muted-foreground">
              Minst 10 tegn. Du logges inn automatisk etterpå.
            </p>
            <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
              <label className="block">
                <span className="mb-1.5 block eyebrow">
                  Nytt passord
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={inputCls}
                  required
                  minLength={10}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block eyebrow">
                  Gjenta passord
                </span>
                <input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  className={inputCls}
                  required
                  minLength={10}
                />
              </label>
              {error && (
                <p className="rounded-lg bg-red-50 px-4 py-3 text-[13px] font-medium text-red-700">
                  {error}
                </p>
              )}
              <PrimaryButton type="submit" disabled={reset.isPending} className="mt-2 w-full">
                {reset.isPending ? "Lagrer …" : "Lagre nytt passord"}
              </PrimaryButton>
            </form>
          </>
        )}
      </AppShell>
    </div>
  );
}
