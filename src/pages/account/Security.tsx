import { useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { KeyRound, MonitorSmartphone, ShieldCheck } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { formatDateShort } from "@/lib/format";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { useAuthProviders } from "@/lib/authProviders";

/** Sikkerhet – hvilke enheter som er logget inn, og én knapp for å kaste ut alle andre. */
export default function Security() {
  usePageMeta(PAGE_META.security);
  const t = useT();
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const utils = trpc.useUtils();
  const sessions = trpc.account.sessions.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const revoke = trpc.account.revokeSession.useMutation({ onSuccess: () => utils.account.sessions.invalidate() });
  const logoutAll = trpc.customerAuth.logoutAll.useMutation({ onSuccess: () => { utils.customerAuth.me.invalidate(); navigate("/logg-inn"); } });
  const { oauth } = useAuthProviders();

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/profil/sikkerhet");
  }, [customer, isLoading, navigate]);
  if (!customer) return null;

  const others = (sessions.data ?? []).filter((s) => !s.current);

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-2xl">
        <AppHeader title={t("sec.title")} back as="h1" />

        <section>
          <h2 className="font-display text-xl">{t("sec.devices")}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("sec.devicessub")}</p>
          <ul className="mt-4 flex flex-col gap-2">
            {(sessions.data ?? []).map((s) => (
              <li key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-muted"><Icon icon={MonitorSmartphone} size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold">
                    {s.device}
                    {s.current && <span className="rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground">{t("sec.thisdevice")}</span>}
                  </span>
                  <span className="block text-[12px] text-muted-foreground">{t("sec.since", { date: formatDateShort(s.createdAt) })}{s.ipHint ? ` · ${s.ipHint}` : ""}</span>
                </span>
                {!s.current && (
                  <button type="button" onClick={() => revoke.mutate({ id: s.id })} disabled={revoke.isPending} className="min-h-10 shrink-0 rounded-lg border border-border px-3 text-[13px] font-semibold hover:border-destructive/40 hover:text-destructive disabled:opacity-60">{t("sec.signout")}</button>
                )}
              </li>
            ))}
          </ul>
          {others.length > 0 && (
            <button type="button" onClick={() => logoutAll.mutate()} disabled={logoutAll.isPending} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-night px-4 text-[14px] font-semibold text-white disabled:opacity-60">
              {t("sec.signoutall")}
            </button>
          )}
          {(revoke.isError || logoutAll.isError) && <p role="alert" className="mt-2 text-[13px] text-destructive">{humanMessage(revoke.error ?? logoutAll.error)}</p>}
          <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><Icon icon={ShieldCheck} size={14} /> {t("sec.alerts")}</p>
        </section>

        {/* Tilkoblede kontoer. Serveren sier hvilke leverandører som faktisk er
            satt opp; er ingen det, sier seksjonen det rett ut i stedet for å
            vise fire knapper som ikke gjør noe. */}
        <section className="mt-8">
          <h2 className="font-display text-xl">{t("sec.linked")}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("sec.linkedsub")}</p>
          {oauth.length === 0 ? (
            <p className="mt-4 rounded-xl bg-muted/60 px-4 py-3.5 text-[13px] text-muted-foreground">{t("sec.linked.none")}</p>
          ) : (
            <ul className="mt-4 flex flex-col gap-2">
              {oauth.map((prov) => {
                const Mark = prov.icon;
                return (
                  <li key={prov.id} className="surface flex items-center gap-3 px-4 py-3">
                    <Mark className="size-5 shrink-0" />
                    <span className="min-w-0 flex-1 text-[15px] font-semibold">{prov.label}</span>
                    <a
                      href={prov.startPath}
                      className="press inline-flex min-h-10 items-center rounded-lg border border-border px-3.5 text-sm font-semibold transition-colors hover:border-foreground/40"
                    >
                      {t("sec.linked.connect")}
                    </a>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="mt-8 rounded-xl border border-border bg-card p-5">
          <h2 className="flex items-center gap-2 font-display text-xl"><Icon icon={KeyRound} size={20} /> {t("sec.password")}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{t("sec.passwordsub")}</p>
          <Link to="/profil/rediger#passord" className="mt-3 inline-flex min-h-11 items-center rounded-lg border border-border px-4 text-[14px] font-semibold hover:border-foreground/40">{t("sec.change")}</Link>
        </section>
      </AppShell>
    </div>
  );
}
