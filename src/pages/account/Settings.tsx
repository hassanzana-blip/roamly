import { Car, CircleHelp, Globe, Mail, Moon, Radar, ShieldCheck, UserPen, Wallet } from "lucide-react";
import { AccountPage, AccountSection } from "@/components/account/AccountPage";
import { AccountGroup, AccountRow, ControlRow, Toggle } from "@/components/account/AccountRow";
import { useCustomer } from "@/lib/useCustomer";
import { CURRENCIES, LANGS, LANG_LABELS, useLang, useLocale, useT, type Currency, type Lang } from "@/lib/i18n";
import { PAGE_META, usePageMeta } from "@/lib/seo";
import { useTheme } from "@/lib/theme";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";

/**
 * Innstillinger. Alt som er en bryter eller et valg bor her, slik at
 * profilen kan handle om reisene i stedet for om kontoen. Her er lister
 * riktig form: dette er nettopp en liste med valg.
 */

const selectCls =
  "min-h-10 rounded-lg border border-border bg-card px-3 text-[13px] font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring";

export default function Settings() {
  usePageMeta(PAGE_META.profile);
  const t = useT();
  const { customer } = useCustomer();
  const { lang, setLang } = useLang();
  const { currency, setCurrency } = useLocale();
  const { dark, setDark } = useTheme();
  const utils = trpc.useUtils();
  const prefs = trpc.customerAuth.updatePreferences.useMutation({ onSuccess: () => utils.customerAuth.me.invalidate() });

  return (
    <AccountPage title={t("profile.settings")} intro={t("settings.intro")}>
      {customer && (
        <AccountSection title={t("acct.group.account")}>
          <AccountGroup>
            <AccountRow to="/profil/rediger" icon={UserPen} title={t("acct.edit")} sub={t("acct.editsub")} />
            <AccountRow to="/profil/sikkerhet" icon={ShieldCheck} title={t("acct.security")} sub={t("acct.securitysub")} />
            <ControlRow icon={Mail} title={t("pf.marketing")} sub={t("pf.marketingsub")}>
              <Toggle checked={customer.marketingConsent} disabled={prefs.isPending} label={t("pf.marketing")} onChange={(v) => prefs.mutate({ marketingConsent: v })} />
            </ControlRow>
          </AccountGroup>
          {prefs.isError && <p role="alert" className="mt-2 text-[12px] text-destructive">{humanMessage(prefs.error)}</p>}
        </AccountSection>
      )}

      <AccountSection title={t("profile.settings")}>
        <AccountGroup>
          <ControlRow icon={Globe} title={t("profile.language")} htmlFor="pref-locale">
            <select id="pref-locale" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className={selectCls}>
              {LANGS.map((l) => <option key={l} value={l}>{LANG_LABELS[l]}</option>)}
            </select>
          </ControlRow>
          <ControlRow icon={Wallet} title={t("profile.currency")} sub={t("pf.currencyhint")} htmlFor="pref-currency">
            <select id="pref-currency" value={currency} onChange={(e) => setCurrency(e.target.value as Currency)} className={selectCls}>
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </ControlRow>
          <ControlRow icon={Moon} title={t("profile.theme")}>
            <Toggle checked={dark} onChange={setDark} label={t("profile.theme")} />
          </ControlRow>
        </AccountGroup>
      </AccountSection>

      <AccountSection title={t("acct.group.more")}>
        <AccountGroup>
          <AccountRow to="/hjelp" icon={CircleHelp} title={t("acct.help")} sub={t("acct.helpsub")} />
          {customer && <AccountRow to="/profil/rediger#personvern" icon={ShieldCheck} title={t("pf.privacy")} sub={t("pf.export")} />}
          <AccountRow to="/flystatus" icon={Radar} title={t("profile.flightstatus")} sub={t("profile.flightstatussub")} />
          <AccountRow to="/hotell-bil" icon={Car} title={t("profile.hotelcar")} sub={t("profile.hotelcarsub")} />
        </AccountGroup>
      </AccountSection>
    </AccountPage>
  );
}
