import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Check, Copy, Mail, MessageSquare, Share2 } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { WhatsAppIcon } from "@/components/WhatsAppFab";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { trpc } from "@/providers/trpc";

/**
 * Inviter venner – lenke, deling og et dashbord som bare teller ekte kontoer
 * og ekte reiser. Ingen mottakere lagres; vi teller kun at det ble delt.
 */
export default function Referral() {
  usePageMeta(PAGE_META.referral);
  const t = useT();
  const navigate = useNavigate();
  const { customer, isLoading } = useCustomer();
  const utils = trpc.useUtils();
  const q = trpc.account.referral.useQuery(undefined, { enabled: Boolean(customer), retry: false });
  const shared = trpc.account.referralShared.useMutation({ onSuccess: () => utils.account.referral.invalidate() });
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn?next=/profil/inviter");
  }, [customer, isLoading, navigate]);
  if (!customer) return null;
  const r = q.data;
  const link = r?.link ?? "";
  const message = t("rf.msg", { link });
  const canShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      shared.mutate();
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* utklippstavle utilgjengelig */
    }
  };
  const share = async () => {
    try {
      await navigator.share({ title: "HelloSky", text: message, url: link });
      shared.mutate();
    } catch {
      /* avbrutt */
    }
  };

  const stats = r
    ? [
        { k: t("rf.shares"), v: r.shares },
        { k: t("rf.signedup"), v: r.signedUp },
        { k: t("rf.qualified"), v: r.qualified },
        { k: t("rf.earned"), v: `${r.earnedKr} kr` },
      ]
    : [];

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell className="max-w-2xl">
        <AppHeader title={t("rf.title")} back as="h1" />
        {r && <p className="mb-6 max-w-lg text-[15px] leading-relaxed text-muted-foreground">{t("rf.intro", { a: r.referrerKr, b: r.referredKr })}</p>}

        <section className="rounded-2xl bg-night p-5 text-white">
          <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-primary">{t("rf.yourlink")}</p>
          <p className="mt-2 break-all font-mono text-[13px] text-white/85">{link || "…"}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copy} disabled={!link} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 text-[14px] font-semibold text-primary-foreground disabled:opacity-60">
              <Icon icon={copied ? Check : Copy} size={16} /> {copied ? t("rf.copied") : t("rf.copy")}
            </button>
            <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer" onClick={() => shared.mutate()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-[14px] font-semibold hover:bg-white/10">
              <WhatsAppIcon className="h-4 w-4" /> WhatsApp
            </a>
            <a href={`sms:?&body=${encodeURIComponent(message)}`} onClick={() => shared.mutate()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-[14px] font-semibold hover:bg-white/10">
              <Icon icon={MessageSquare} size={16} /> {t("rf.sms")}
            </a>
            <a href={`mailto:?subject=${encodeURIComponent("HelloSky")}&body=${encodeURIComponent(message)}`} onClick={() => shared.mutate()} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-[14px] font-semibold hover:bg-white/10">
              <Icon icon={Mail} size={16} /> {t("rf.email")}
            </a>
            {canShare && (
              <button type="button" onClick={share} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-4 text-[14px] font-semibold hover:bg-white/10">
                <Icon icon={Share2} size={16} /> {t("rf.share")}
              </button>
            )}
          </div>
        </section>

        <section className="mt-6">
          <h2 className="font-display text-xl">{t("rf.stats")}</h2>
          <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {stats.map((s) => (
              <div key={s.k} className="rounded-xl border border-border bg-card p-4">
                <p className="text-[26px] font-semibold leading-none tabular">{s.v}</p>
                <p className="mt-2 text-[12px] text-muted-foreground">{s.k}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-muted-foreground">{t("rf.note")}</p>
        </section>
      </AppShell>
    </div>
  );
}
