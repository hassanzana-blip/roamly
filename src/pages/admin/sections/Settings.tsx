import { useState } from "react";
import { CheckCircle2, CircleAlert, KeyRound, RefreshCw, Send, UserPlus, UserX } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { Btn, Card, ErrorState, Field, PageHeader, Pill } from "../ui";
import { formatDateTime, inputCls, selectCls } from "../helpers";
import { useActionFeedback } from "../useActionFeedback";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ROLE_LABEL: Record<string, string> = {
  OWNER: "Eier",
  ADMIN: "Administrator",
  SUPPORT: "Kundeservice",
  FINANCE: "Økonomi",
  READ_ONLY: "Kun lesing",
};

function StatusRow({ ok, label, okText, badText }: { ok: boolean; label: string; okText: string; badText: string }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
      <span className="text-foreground">{label}</span>
      <Pill tone={ok ? "success" : "danger"}>
        {ok ? <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> : <CircleAlert className="h-3 w-3" aria-hidden="true" />}
        {ok ? okText : badText}
      </Pill>
    </li>
  );
}

/* ── Systemstatus ───────────────────────────────────────────────────────── */

function SystemStatusCard() {
  const status = trpc.admin.systemStatus.useQuery(undefined, { retry: false });
  return (
    <Card>
      <h2 className="mb-3 font-display text-xl font-semibold text-foreground">Systemstatus</h2>
      {status.isLoading ? (
        <p className="text-sm text-muted-foreground">Laster …</p>
      ) : status.error || !status.data ? (
        <ErrorState error={status.error} />
      ) : (
        <ul className="divide-y divide-border">
          <StatusRow ok={status.data.duffelConfigured} label="Duffel API" okText={status.data.duffelLive ? "Live-modus" : "Testmodus"} badText="Ikke konfigurert" />
          <StatusRow ok={status.data.webhookConfigured} label="Duffel webhooks" okText="Signaturverifisering på" badText="Mangler hemmelighet" />
          <StatusRow ok={status.data.stripeConfigured} label="Stripe" okText="Konfigurert" badText="Ikke konfigurert" />
          <StatusRow ok={status.data.stripeWebhookConfigured} label="Stripe webhooks" okText="Signaturverifisering på" badText="Mangler hemmelighet" />
          <StatusRow ok={status.data.smtpConfigured} label="E-post (SMTP)" okText="Konfigurert" badText="Mangler" />
          <StatusRow ok={status.data.piiEncryptionConfigured} label="Kryptering av passdata" okText="Nøkkel satt" badText="Mangler nøkkel" />
          <StatusRow ok={status.data.publicInstantBooking} label="Direktebooking fra nettsiden" okText="På" badText="Av" />
          <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-foreground">Daglig live-grense</span>
            <span className="text-muted-foreground">{status.data.maxDailyLiveAmountMinor != null ? `${(Number(status.data.maxDailyLiveAmountMinor) / 100).toLocaleString("nb-NO")} (minste enhet/100)` : "–"}</span>
          </li>
          <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-foreground">Miljø</span>
            <Pill tone={status.data.environment === "production" ? "danger" : "warning"}>{status.data.environment === "production" ? "Produksjon" : status.data.environment}</Pill>
          </li>
          <li className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="text-foreground">App-URL</span>
            <span className="truncate text-muted-foreground">{status.data.appBaseUrl ?? "–"}</span>
          </li>
        </ul>
      )}
    </Card>
  );
}

/* ── Bonus og henvisning (rewardRulesGet/Set) ─────────────────────────── */

type TierDraft = { id: string; name: string; minCompletedTrips: string; benefits: string };

function RewardsCard() {
  const q = trpc.admin.rewardRulesGet.useQuery(undefined, { retry: false });
  if (q.isLoading) return <Card><p className="text-sm text-muted-foreground">Laster …</p></Card>;
  if (q.error || !q.data) return <Card><ErrorState error={q.error} /></Card>;
  return <RewardsForm key={JSON.stringify(q.data.rules)} rules={q.data.rules} isDefault={q.data.isDefault} />;
}

function RewardsForm({ rules, isDefault }: { rules: { bookingEarnFraction: number; referralReferrerKr: number; referralReferredKr: number; programName: string; tiers: { id: string; name: string; minCompletedTrips: number; benefits: string[] }[] }; isDefault: boolean }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const set = trpc.admin.rewardRulesSet.useMutation({
    onSuccess: () => { fb.flash("Bonusregler lagret."); utils.admin.rewardRulesGet.invalidate(); },
    onError: fb.fail,
  });
  const [programName, setProgramName] = useState(rules.programName);
  const [earnPct, setEarnPct] = useState(String(rules.bookingEarnFraction * 100));
  const [referrerKr, setReferrerKr] = useState(String(rules.referralReferrerKr));
  const [referredKr, setReferredKr] = useState(String(rules.referralReferredKr));
  const [tiers, setTiers] = useState<TierDraft[]>(rules.tiers.map((t) => ({ id: t.id, name: t.name, minCompletedTrips: String(t.minCompletedTrips), benefits: t.benefits.join("\n") })));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    set.mutate({
      programName,
      bookingEarnFraction: Number(earnPct) / 100,
      referralReferrerKr: Number(referrerKr),
      referralReferredKr: Number(referredKr),
      tiers: tiers.map((t) => ({ id: t.id, name: t.name, minCompletedTrips: Number(t.minCompletedTrips), benefits: t.benefits.split("\n").map((b) => b.trim()).filter(Boolean) })),
    });
  };
  const updateTier = (i: number, patch: Partial<TierDraft>) => setTiers((prev) => prev.map((t, j) => (j === i ? { ...t, ...patch } : t)));

  return (
    <Card>
      <h2 className="mb-1 font-display text-xl font-semibold text-foreground">Bonus og henvisning</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Det kunden ser under «Bonus» og «Inviter venner» kommer herfra. {isDefault ? "Standardsatsene gjelder — ingenting er endret ennå." : "Egendefinerte satser er aktive."} Nivåer uten fordeler er bare et navn; skriv bare inn fordeler dere faktisk gir.
      </p>
      {fb.banner}
      <form className="space-y-5" onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Programnavn" htmlFor="rw-name"><input id="rw-name" className={inputCls} value={programName} onChange={(e) => setProgramName(e.target.value)} maxLength={40} /></Field>
          <Field label="Opptjening på bestilling (% av totalpris, kun NOK)" htmlFor="rw-earn"><input id="rw-earn" type="number" step="0.5" min="0" max="20" className={inputCls} value={earnPct} onChange={(e) => setEarnPct(e.target.value)} /></Field>
          <Field label="Henvisning: kroner til den som inviterte" htmlFor="rw-ref1" hint="Krediteres når den inviterte har fullført sin første reise."><input id="rw-ref1" type="number" min="0" max="5000" className={inputCls} value={referrerKr} onChange={(e) => setReferrerKr(e.target.value)} /></Field>
          <Field label="Henvisning: kroner til den inviterte" htmlFor="rw-ref2"><input id="rw-ref2" type="number" min="0" max="5000" className={inputCls} value={referredKr} onChange={(e) => setReferredKr(e.target.value)} /></Field>
        </div>
        <div className="space-y-3">
          <p className="text-sm font-semibold text-foreground">Nivåer</p>
          {tiers.map((t, i) => (
            <div key={i} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_120px]">
              <Field label="ID (a–z, 0–9)" htmlFor={`rw-tier-id-${i}`}><input id={`rw-tier-id-${i}`} className={inputCls} value={t.id} onChange={(e) => updateTier(i, { id: e.target.value })} /></Field>
              <Field label="Navn" htmlFor={`rw-tier-name-${i}`}><input id={`rw-tier-name-${i}`} className={inputCls} value={t.name} onChange={(e) => updateTier(i, { name: e.target.value })} /></Field>
              <Field label="Fra antall reiser" htmlFor={`rw-tier-min-${i}`}><input id={`rw-tier-min-${i}`} type="number" min="0" className={inputCls} value={t.minCompletedTrips} onChange={(e) => updateTier(i, { minCompletedTrips: e.target.value })} /></Field>
              <div className="sm:col-span-3">
                <Field label="Fordeler (én per linje)" htmlFor={`rw-tier-ben-${i}`}><textarea id={`rw-tier-ben-${i}`} rows={3} className={inputCls} value={t.benefits} onChange={(e) => updateTier(i, { benefits: e.target.value })} /></Field>
              </div>
              {tiers.length > 1 && (
                <div className="sm:col-span-3"><Btn tone="ghost" onClick={() => setTiers((prev) => prev.filter((_, j) => j !== i))}>Fjern nivå</Btn></div>
              )}
            </div>
          ))}
          {tiers.length < 5 && <Btn tone="ghost" onClick={() => setTiers((prev) => [...prev, { id: "", name: "", minCompletedTrips: "0", benefits: "" }])}>Legg til nivå</Btn>}
        </div>
        <Btn type="submit" disabled={set.isPending}>Lagre bonusregler</Btn>
      </form>
    </Card>
  );
}

/* ── Innstillinger (settingsGet/settingsSet) ───────────────────────────── */

const CURRENCIES = ["NOK", "SEK", "DKK", "EUR", "GBP", "USD"];

type SettingRow = { key: string; value: unknown; updatedAt: Date | string | null };

function SettingsForm() {
  const settings = trpc.admin.settingsGet.useQuery(undefined, { retry: false });
  if (settings.isLoading) return <Card><p className="text-sm text-muted-foreground">Laster …</p></Card>;
  if (settings.error || !settings.data) return <Card><ErrorState error={settings.error} /></Card>;
  // Nøkkel på innholdet: skjemaet re-initialiseres når serververdiene endres.
  return <SettingsFormInner key={JSON.stringify(settings.data.map((s) => [s.key, s.value]))} rows={settings.data} />;
}

function SettingsFormInner({ rows }: { rows: SettingRow[] }) {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const set = trpc.admin.settingsSet.useMutation({
    onSuccess: () => { fb.flash("Innstilling lagret."); utils.admin.settingsGet.invalidate(); utils.admin.systemStatus.invalidate(); },
    onError: fb.fail,
  });
  const row = (key: string) => rows.find((r) => r.key === key);

  const [feePolicy, setFeePolicy] = useState<"keep" | "refund">(() => (row("refund.service_fee_policy")?.value as "keep" | "refund" | null) ?? "keep");
  const [instant, setInstant] = useState<"default" | "on" | "off">(() => {
    const v = row("booking.instant_enabled")?.value;
    return v == null ? "default" : v ? "on" : "off";
  });
  const [markupPercent, setMarkupPercent] = useState(() => {
    const v = row("markup.percent")?.value;
    return v == null ? "" : String(Number(v) * 100);
  });
  const [flat, setFlat] = useState<Record<string, string>>(() => {
    const v = (row("markup.flat_minor_by_currency")?.value as Record<string, number> | null) ?? {};
    return Object.fromEntries(Object.entries(v).map(([k, n]) => [k, (n / 100).toFixed(2)]));
  });

  const updatedAt = (key: string) => row(key)?.updatedAt;

  return (
    <Card>
      <h2 className="mb-1 font-display text-xl font-semibold text-foreground">Forretningsregler</h2>
      <p className="mb-4 text-sm text-muted-foreground">Endringer gjelder umiddelbart og logges i aktivitetsloggen.</p>
      {fb.banner}
      <div className="space-y-6">
        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); set.mutate({ key: "refund.service_fee_policy", value: feePolicy }); }}>
          <Field label="Servicegebyr ved refusjon" htmlFor="s-fee" hint={`Sist endret ${formatDateTime(updatedAt("refund.service_fee_policy"))}`}>
            <div className="flex flex-wrap gap-2">
              <select id="s-fee" value={feePolicy} onChange={(e) => setFeePolicy(e.target.value as "keep" | "refund")} className={selectCls}>
                <option value="keep">Beholdes (standard)</option>
                <option value="refund">Refunderes</option>
              </select>
              <Btn type="submit" tone="ghost" disabled={set.isPending}>Lagre</Btn>
            </div>
          </Field>
        </form>

        <form className="space-y-2" onSubmit={(e) => { e.preventDefault(); set.mutate({ key: "booking.instant_enabled", value: instant === "default" ? null : instant === "on" }); }}>
          <Field label="Direktebooking fra nettsiden" htmlFor="s-instant" hint="«Standard» følger miljøvariabelen INSTANT_BOOKING_ENABLED.">
            <div className="flex flex-wrap gap-2">
              <select id="s-instant" value={instant} onChange={(e) => setInstant(e.target.value as "default" | "on" | "off")} className={selectCls}>
                <option value="default">Standard (miljø)</option>
                <option value="on">På</option>
                <option value="off">Av</option>
              </select>
              <Btn type="submit" tone="ghost" disabled={set.isPending}>Lagre</Btn>
            </div>
          </Field>
        </form>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = markupPercent.trim();
            set.mutate({ key: "markup.percent", value: v === "" ? null : Number(v.replace(",", ".")) / 100 });
          }}
        >
          <Field label="Servicegebyr i prosent" htmlFor="s-pct" hint="Tomt = standard fra miljø (8 %). Oppgi f.eks. 8 for 8 %.">
            <div className="flex flex-wrap gap-2">
              <input id="s-pct" inputMode="decimal" value={markupPercent} onChange={(e) => setMarkupPercent(e.target.value)} className={`${inputCls} max-w-[140px]`} placeholder="8" />
              <Btn type="submit" tone="ghost" disabled={set.isPending}>Lagre</Btn>
            </div>
          </Field>
        </form>

        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            const entries = Object.entries(flat).filter(([, v]) => v.trim() !== "");
            const value = entries.length === 0 ? null : Object.fromEntries(entries.map(([k, v]) => [k, Math.round(Number(v.replace(",", ".")) * 100)]));
            if (value && Object.values(value).some((n) => !Number.isFinite(n) || n < 0)) { fb.fail({ message: "Ugyldig beløp." }); return; }
            set.mutate({ key: "markup.flat_minor_by_currency", value });
          }}
        >
          <Field label="Fast gebyr per valuta" hint="Desimalbeløp per bestilling (f.eks. 250.00). Tomme felt bruker standard fra pricing.ts.">
            <div className="grid gap-2 sm:grid-cols-3">
              {CURRENCIES.map((c) => (
                <label key={c} className="flex items-center gap-2 text-sm">
                  <span className="w-10 font-semibold text-foreground">{c}</span>
                  <input inputMode="decimal" value={flat[c] ?? ""} onChange={(e) => setFlat((f) => ({ ...f, [c]: e.target.value }))} className={inputCls} placeholder="standard" aria-label={`Fast gebyr ${c}`} />
                </label>
              ))}
            </div>
            <Btn type="submit" tone="ghost" className="mt-2" disabled={set.isPending}>Lagre faste gebyrer</Btn>
          </Field>
        </form>
      </div>
      {fb.reauthDialog}
    </Card>
  );
}

/* ── Ansatte ────────────────────────────────────────────────────────────── */

function StaffCard() {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const me = trpc.staffAuth.me.useQuery(undefined, { retry: false });
  const perms = trpc.staffAuth.myPermissions.useQuery(undefined, { staleTime: 60_000, retry: false });
  const canManage = perms.data?.permissions.includes("staff:manage") ?? false;
  const staff = trpc.staffAuth.listStaff.useQuery(undefined, { retry: false });
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("SUPPORT");
  const [inviteResult, setInviteResult] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<{ kind: "disable" | "enable"; userId: number; name: string } | null>(null);

  const refresh = () => utils.staffAuth.listStaff.invalidate();
  const invite = trpc.staffAuth.createInvite.useMutation({
    onSuccess: (r) => { setInviteResult(r.setupUrl); setInviteEmail(""); setInviteName(""); fb.flash("Invitasjon opprettet."); refresh(); },
    onError: (e) => { setInviteResult(null); fb.fail(e); },
  });
  const updateRole = trpc.staffAuth.updateRole.useMutation({ onSuccess: () => { fb.flash("Rolle endret – brukeren må logge inn på nytt."); refresh(); }, onError: fb.fail });
  const setStatus = trpc.staffAuth.setStatus.useMutation({ onSuccess: () => { fb.flash("Status endret."); refresh(); }, onError: fb.fail });

  const myId = me.data?.authenticated ? me.data.userId : null;

  return (
    <Card>
      <h2 className="mb-3 font-display text-xl font-semibold text-foreground">Ansatte</h2>
      {fb.banner}
      {staff.isLoading ? (
        <p className="text-sm text-muted-foreground">Laster …</p>
      ) : staff.error || !staff.data ? (
        <p className="text-sm text-muted-foreground">{staff.error?.message ?? "Krever tilgang til personaladministrasjon."}</p>
      ) : (
        <>
          <ul className="divide-y divide-border">
            {staff.data.map((s) => {
              const isMe = s.id === myId;
              return (
                <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <p className="font-semibold text-foreground">{s.name}{isMe && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(deg)</span>}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.email} · sist innlogget {formatDateTime(s.lastLoginAt)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {canManage && !isMe ? (
                      <select
                        value={s.role}
                        aria-label={`Rolle for ${s.name}`}
                        onChange={(e) => updateRole.mutate({ userId: s.id, role: e.target.value as never, confirmFreshSession: true })}
                        disabled={updateRole.isPending}
                        className={selectCls}
                      >
                        {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    ) : (
                      <Pill tone="info">{ROLE_LABEL[s.role] ?? s.role}</Pill>
                    )}
                    <Pill tone={s.status === "active" ? "success" : "warning"}>{s.status === "active" ? "Aktiv" : s.status === "invited" ? "Invitert" : "Deaktivert"}</Pill>
                    {canManage && !isMe && (
                      <>
                        {s.status === "active" ? (
                          <Btn tone="ghost" onClick={() => setConfirm({ kind: "disable", userId: s.id, name: s.name })} aria-label={`Deaktiver ${s.name}`}><UserX className="h-4 w-4" aria-hidden="true" /></Btn>
                        ) : s.status === "disabled" ? (
                          <Btn tone="ghost" onClick={() => setConfirm({ kind: "enable", userId: s.id, name: s.name })}>Aktiver</Btn>
                        ) : null}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          {canManage && (
            <form
              className="mt-4 space-y-3 border-t border-border pt-4"
              onSubmit={(e) => { e.preventDefault(); if (inviteEmail.trim() && inviteName.trim()) invite.mutate({ email: inviteEmail.trim(), name: inviteName.trim(), role: inviteRole as never }); }}
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <UserPlus className="h-4 w-4 text-primary" aria-hidden="true" /> Inviter ny ansatt
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input type="text" value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="Navn" aria-label="Navn på ny ansatt" className={inputCls} />
                <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="E-post" aria-label="E-post til ny ansatt" className={inputCls} />
              </div>
              <div className="flex flex-wrap gap-2">
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} aria-label="Rolle for ny ansatt" className={`${selectCls} flex-1`}>
                  {Object.entries(ROLE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
                <Btn type="submit" tone="night" disabled={invite.isPending || !inviteEmail.trim() || !inviteName.trim()}>
                  <Send className="h-4 w-4" aria-hidden="true" /> {invite.isPending ? "Oppretter …" : "Lag invitasjon"}
                </Btn>
              </div>
              {inviteResult && (
                <div className="rounded-xl border border-success/30 bg-success/5 px-4 py-3">
                  <p className="text-sm font-semibold text-success">Engangslenke opprettet – send denne sikkert til den ansatte (vises kun nå, gyldig 48 t):</p>
                  <p className="mt-1.5 select-all break-all rounded-lg bg-card px-3 py-2 font-mono text-xs text-foreground">{inviteResult}</p>
                </div>
              )}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><KeyRound className="h-3.5 w-3.5" aria-hidden="true" /> Invitasjon, rolleendring og deaktivering krever nylig innlogging.</p>
            </form>
          )}
        </>
      )}
      <AlertDialog open={confirm != null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "disable" ? `Deaktivere ${confirm.name}?` : `Aktivere ${confirm?.name}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "disable"
                ? "Alle aktive sesjoner logges ut umiddelbart, og brukeren kan ikke logge inn før kontoen aktiveres igjen."
                : "Brukeren kan logge inn igjen med samme passord."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Avbryt</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!confirm) return;
                setStatus.mutate({ userId: confirm.userId, status: confirm.kind === "disable" ? "disabled" : "active", confirmFreshSession: true });
                setConfirm(null);
              }}
            >
              Bekreft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {fb.reauthDialog}
    </Card>
  );
}

/* ── Jobber og webhooks ─────────────────────────────────────────────────── */

const JOB_STATUS_LABELS: Record<string, string> = { dead: "Døde", failed: "Feilede", pending: "Ventende", done: "Fullførte" };

function JobsCard() {
  const utils = trpc.useUtils();
  const fb = useActionFeedback();
  const [status, setStatus] = useState<"dead" | "failed" | "pending" | "done">("dead");
  const jobs = trpc.admin.jobsList.useQuery({ status }, { retry: false, refetchInterval: 30_000 });
  const retry = trpc.admin.retryJobAction.useMutation({
    onSuccess: () => { fb.flash("Jobben er lagt tilbake i køen."); utils.admin.jobsList.invalidate(); utils.admin.dashboard.invalidate(); },
    onError: fb.fail,
  });
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold text-foreground">Jobbkø</h2>
        <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} aria-label="Jobbstatus" className={selectCls}>
          {Object.entries(JOB_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {fb.banner}
      {jobs.isLoading ? (
        <p className="text-sm text-muted-foreground">Laster …</p>
      ) : jobs.error || !jobs.data ? (
        <p className="text-sm text-muted-foreground">{jobs.error?.message ?? "Krever tilgang."}</p>
      ) : jobs.data.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Ingen {JOB_STATUS_LABELS[status].toLowerCase()} jobber.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {jobs.data.map((j) => (
            <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-3 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground">#{j.id} {j.type}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{j.attempts}/{j.maxAttempts} forsøk · {formatDateTime(j.updatedAt)}{j.dedupeKey ? ` · ${j.dedupeKey}` : ""}</p>
                {j.lastError && <p className="mt-1 max-w-md truncate text-xs text-destructive" title={j.lastError}>{j.lastError}</p>}
              </div>
              {(status === "dead" || status === "failed") && (
                <Btn tone="ghost" onClick={() => retry.mutate({ jobId: j.id })} disabled={retry.isPending}>
                  <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Prøv igjen
                </Btn>
              )}
            </li>
          ))}
        </ul>
      )}
      {fb.reauthDialog}
    </Card>
  );
}

function WebhooksCard() {
  const webhooks = trpc.admin.webhookEventsList.useQuery(undefined, { retry: false, refetchInterval: 60_000 });
  return (
    <Card>
      <h2 className="mb-3 font-display text-xl font-semibold text-foreground">Siste webhooks (Duffel og Stripe)</h2>
      {webhooks.isLoading ? (
        <p className="text-sm text-muted-foreground">Laster …</p>
      ) : webhooks.error || !webhooks.data ? (
        <p className="text-sm text-muted-foreground">{webhooks.error?.message ?? "Krever tilgang."}</p>
      ) : webhooks.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">Ingen webhooks mottatt ennå.</p>
      ) : (
        <ul className="space-y-2">
          {webhooks.data.map((w) => (
            <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border px-4 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-foreground">
                  <span className="mr-1.5 rounded bg-muted px-1.5 py-0.5 uppercase">{w.provider}</span>{w.eventType}
                </p>
                <p className="text-xs text-muted-foreground">{formatDateTime(w.createdAt)}{w.attempts > 1 ? ` · ${w.attempts} forsøk` : ""}</p>
                {w.error && <p className="mt-1 max-w-md truncate text-xs text-destructive" title={w.error}>{w.error}</p>}
              </div>
              <Pill tone={w.status === "processed" ? "success" : w.status === "failed" ? "danger" : "warning"}>{w.status}</Pill>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function AdminSettings() {
  return (
    <div>
      <PageHeader title="Innstillinger" description="Systemstatus, forretningsregler, ansatte, jobbkø og webhooks." />
      <Tabs defaultValue="system">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="system">System</TabsTrigger>
          <TabsTrigger value="rules">Regler</TabsTrigger>
          <TabsTrigger value="staff">Ansatte</TabsTrigger>
          <TabsTrigger value="jobs">Jobber og webhooks</TabsTrigger>
        </TabsList>
        <TabsContent value="system"><SystemStatusCard /></TabsContent>
        <TabsContent value="rules"><div className="space-y-6"><SettingsForm /><RewardsCard /></div></TabsContent>
        <TabsContent value="staff"><StaffCard /></TabsContent>
        <TabsContent value="jobs">
          <div className="grid gap-6 lg:grid-cols-2">
            <JobsCard />
            <WebhooksCard />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
