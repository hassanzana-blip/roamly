import { useEffect, useState, type ReactNode } from "react";
import { AccessibilityInfo, ActivityIndicator, ScrollView, StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "../../components/a11y";
import { StatusBarShield } from "../../components/StatusBarShield";
import { Icon, type IconName } from "../../components/Icon";
import { SignInSheet, type SignInMode } from "../../components/SignInSheet";
import { DestinationCard } from "../../components/DestinationCard";
import { useRouter } from "expo-router";
import { FocusStatusBar } from "../../components/FocusStatusBar";
import Constants from "expo-constants";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import type { CustomerProfile } from "@contracts/mobileAuth";
import { useApp } from "../../lib/appState";
import { ApiError } from "../../lib/api";
import { errorText } from "../../lib/errorText";
import { WEB_PAGES } from "../../lib/config";
import { destinationChoice, type Destination } from "../../lib/destinations";
import { savedDestinations } from "../../lib/saved";
import { recentIsPast, recentKey, withFreshDates, type RecentSearch } from "../../lib/recent";
import { localizedChoice } from "../../lib/airportIndex";
import { keepDatesTogether } from "../../lib/format";
import { cabinLabel, formErrorText, passengerSummary, validateForm } from "../../lib/searchForm";
import { greetingName } from "../../lib/customerName";
import type { FormErrorCode } from "../../i18n/ns/search";
import { Banner, BottomSheet, Field, LinkButton, PrimaryButton, SecondaryButton, Segmented } from "../../components/ui";
import { a11yLanguage, useA11yLanguage, useI18n } from "../../i18n";
import { LOCALES, LOCALE_NAMES, type Locale } from "../../i18n/types";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Nettsidene åpnes i Safari-visning, som tilbydernes sider. */
function openWeb(url: string) {
  WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined);
}

/** Flyplassøket i «vanlig avreiseflyplass»-modus (se app/flyplass.tsx): valget huskes og blir «Fra» i skjemaet. */
const HOME_AIRPORT_PICKER = { pathname: "/flyplass", params: { felt: "fra", hjem: "1" } };

/** Fra denne tekststørrelsen (iOS' «xxxLarge» er 1,35) står en rads verdi under tittelen i stedet for til høyre. */
const STACK_VALUE_AT = 1.3;

/** Hver flis i oversikten er minst så bred (ganger tekststørrelsen), så det lengste ordet i etiketten får plass. */
const TILE_BASIS = 88;

/** Den vanlige avreiseflyplassen som «Oslo (OSL)», med byen på appens språk – eller null når kunden ikke har valgt en. */
function useHomeAirport(): { iata: string; text: string } | null {
  const { homeAirport } = useApp();
  const { locale } = useI18n();
  if (!homeAirport) return null;
  const a = localizedChoice(homeAirport, locale);
  return { iata: a.iata, text: `${a.city} (${a.iata})` };
}

/**
 * En gruppe i listen, som i iOS' innstillinger: overskrift på den lyse grunnen og et hvitt kort med rader.
 * `note` står under kortet (f.eks. at nettsidene er på norsk). Overskriften har samme stil som modulene over
 * («Fortsett søket», «Lagrede reisemål») og seksjonene i Lagret – små versaler – så siden leses som én liste.
 */
function Group({ title, children, testID, note }: { title?: string; children: ReactNode; testID?: string; note?: string | null }) {
  return (
    <View style={styles.group} testID={testID}>
      {title ? (
        <Text style={styles.groupTitle} accessibilityRole="header">
          {title}
        </Text>
      ) : null}
      <View style={styles.groupCard}>{children}</View>
      {note ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{note}</Text> : null}
    </View>
  );
}

/**
 * Én rad i en gruppe: ikon, tittel (og ev. en linje under), verdi til høyre og pil. Uten `onPress` er raden bare
 * informasjon – ingen pil, og VoiceOver leser den som én tekst. En handling (`action`: logg ut, slett) har ingen pil,
 * for den åpner ingen side. Hele raden er trykkflaten (minst 52 pt); VoiceOver hører tittelen og linjen under.
 */
function Row({
  icon,
  title,
  subtitle,
  value,
  onPress,
  external,
  danger,
  action,
  separated,
  testID,
  accessibilityHint,
  accessibilityLabel,
}: {
  icon: IconName;
  title: string;
  subtitle?: string | null;
  value?: string | null;
  onPress?: () => void;
  external?: boolean;
  danger?: boolean;
  action?: boolean;
  separated?: boolean;
  testID?: string;
  accessibilityHint?: string;
  /** VoiceOver-etiketten når den synlige rekkefølgen ikke er den beste å høre (f.eks. «Navn: Kari Nordmann»). */
  accessibilityLabel?: string;
}) {
  const lang = useA11yLanguage();
  const { fontScale } = useWindowDimensions();
  const fg = danger ? colors.danger : colors.text;
  const muted = danger ? colors.danger : colors.textSecondary;
  // Med stor tekst står verdien under tittelen, som i iOS' innstillinger: ved siden av fikk et langt ord i tittelen
  // («avreiseflyplass») ikke plass og ble delt midt i ordet.
  const stacked = !!value && fontScale >= STACK_VALUE_AT;
  const inner = (
    <>
      <Icon name={icon} size={20} color={muted} strokeWidth={1.75} />
      <View style={styles.rowText}>
        {/* Ingen linjegrense: lange titler og stor tekst bryter linjen. */}
        <Text style={[type.body, { color: fg }]}>{title}</Text>
        {subtitle ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
        {stacked ? <Text style={[type.callout, { color: colors.textSecondary }]}>{value}</Text> : null}
      </View>
      {value && !stacked ? <Text style={[type.callout, styles.rowValue]}>{value}</Text> : null}
      {onPress && !action ? <Icon name={external ? "external" : "chevronRight"} size={18} color={muted} /> : null}
    </>
  );
  if (!onPress) {
    return (
      <View accessible accessibilityLanguage={lang} accessibilityLabel={accessibilityLabel ?? [title, value, subtitle].filter(Boolean).join(", ")} style={[styles.row, separated && styles.rowBorder]} testID={testID}>
        {inner}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={external ? "link" : "button"}
      accessibilityLabel={accessibilityLabel ?? [title, subtitle].filter(Boolean).join(", ")}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.row, separated && styles.rowBorder, pressed && { backgroundColor: colors.inset }]}
    >
      {inner}
    </Pressable>
  );
}

/**
 * Innstillingene: språket (før og etter innlogging, gjelder med én gang og huskes på telefonen) og valutaen, som
 * alltid er NOK – en informasjonsrad, ikke et valg.
 */
function SettingsGroup() {
  const { t, locale, setLocale } = useI18n();
  const a = t.account;
  return (
    <Group title={a.settingsTitle} testID="settings-group">
      <View style={styles.block} testID="language-card">
        <View style={styles.blockHead}>
          <Icon name="globe" size={20} color={colors.textSecondary} strokeWidth={1.75} />
          <Text style={[type.body, { color: colors.text }]}>{a.language}</Text>
        </View>
        {/* Hvert språk står på sitt eget språk, og VoiceOver leser det med den stemmen. */}
        <Segmented<Locale> label={a.language} value={locale} options={LOCALES.map((l) => ({ value: l, label: LOCALE_NAMES[l], lang: a11yLanguage(l) }))} onChange={setLocale} />
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{a.languageHint}</Text>
      </View>
      <Row icon="banknote" title={a.currency} subtitle={a.currencyNote} value={a.currencyValue} separated testID="currency-row" />
    </Group>
  );
}

/** HelloSkys egne sider for hjelp, kontakt, personvern og vilkår (åpnes i Safari-visning). */
function HelpGroup() {
  const { t, locale } = useI18n();
  const a = t.account;
  return (
    <Group title={a.helpTitle} testID="help-card" note={locale === "en" ? a.webNorwegian : null}>
      <Row icon="help" title={a.helpCentre} external onPress={() => openWeb(WEB_PAGES.help)} testID="link-help" accessibilityHint={a.webOpens} />
      <Row icon="lock" title={a.privacy} external separated onPress={() => openWeb(WEB_PAGES.privacy)} testID="link-privacy" accessibilityHint={a.webOpens} />
      <Row icon="info" title={a.terms} external separated onPress={() => openWeb(WEB_PAGES.terms)} testID="link-terms" accessibilityHint={a.webOpens} />
      <Row icon="plane" title={a.about} external separated onPress={() => openWeb(WEB_PAGES.about)} testID="link-about" accessibilityHint={a.webOpens} />
    </Group>
  );
}

/**
 * Kundens egne sider på hellosky.no – reiser, lagrede reisende, prisvarsler og sikkerhet. Appen har dem ikke selv, så
 * den viser ingen tall eller lister herfra; lenkene åpner nettets sider i Safari-visning, der kunden logger inn med
 * samme konto første gang. «Mine reiser» er bestillinger gjort på nettet – linjen under sier det, så ingen leter etter
 * søkene fra appen der.
 */
function WebAccountGroup() {
  const { t } = useI18n();
  const a = t.account;
  return (
    <Group title={a.webAccountTitle} testID="web-account-group" note={a.webAccountNote}>
      <Row icon="luggage" title={a.trips} subtitle={a.tripsNote} external onPress={() => openWeb(WEB_PAGES.trips)} testID="link-trips" accessibilityHint={a.webOpens} />
      <Row icon="users" title={a.travellers} external separated onPress={() => openWeb(WEB_PAGES.travellers)} testID="link-travellers" accessibilityHint={a.webOpens} />
      <Row icon="bell" title={a.priceAlerts} external separated onPress={() => openWeb(WEB_PAGES.priceAlerts)} testID="link-price-alerts" accessibilityHint={a.webOpens} />
      <Row icon="lock" title={a.security} external separated onPress={() => openWeb(WEB_PAGES.security)} testID="link-security" accessibilityHint={a.webOpens} />
    </Group>
  );
}

/**
 * Reisevaner: den vanlige avreiseflyplassen, som nye søk starter fra. Raden åpner flyplassøket i «vanlig
 * avreiseflyplass»-modus; valget lagres bare på denne telefonen.
 */
function PreferencesGroup() {
  const router = useRouter();
  const { t } = useI18n();
  const a = t.account;
  const home = useHomeAirport();
  return (
    <Group title={a.habitsTitle} testID="preferences-group" note={t.airport.rememberHint}>
      <Row
        icon="takeoff"
        title={a.homeAirport}
        value={home?.text ?? a.notChosen}
        accessibilityLabel={a.homeAirportLabel(home?.text ?? null)}
        accessibilityHint={a.homeAirportHint}
        onPress={() => router.push(HOME_AIRPORT_PICKER)}
        testID="home-airport-row"
      />
    </Group>
  );
}

/** Appens versjon nederst, som i andre innstillinger (til hjelp når kunden kontakter oss). */
function VersionLine() {
  const { t } = useI18n();
  const version = Constants.expoConfig?.version;
  if (!version) return null;
  return (
    <Text style={[type.footnote, styles.version]} testID="app-version">
      {t.account.version(version)}
    </Text>
  );
}

/**
 * Endre navn (samme regler og samme konto som nettet). Telefonnummeret er en
 * innloggingsnøkkel (engangskode på SMS) og kan ikke endres i appen før
 * serveren bekrefter det nye nummeret med en kode.
 */
function EditProfileSheet({ profile, visible, onClose, onSaved }: { profile: CustomerProfile; visible: boolean; onClose: () => void; onSaved: () => void }) {
  const { updateProfile } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  const [firstName, setFirstName] = useState(profile.firstName);
  const [lastName, setLastName] = useState(profile.lastName);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: string | null; text: string } | null>(null);

  const save = async () => {
    setError(null);
    if (!firstName.trim()) return setError({ field: "firstName", text: a.fieldErrors.firstName });
    if (!lastName.trim()) return setError({ field: "lastName", text: a.fieldErrors.lastName });
    setBusy(true);
    try {
      // Kontoens språk (e-post) endres bare når kunden faktisk har valgt språk i appen – ikke av standarden.
      await updateProfile({ firstName: firstName.trim(), lastName: lastName.trim(), ...(i18n.chosen ? { locale: i18n.locale } : {}) });
      onSaved();
    } catch (e) {
      const field = e instanceof ApiError ? (e.field ?? null) : null;
      const specific = e instanceof ApiError && e.code === "VALIDATION" && (field === "firstName" || field === "lastName") ? a.fieldErrors[field] : errorText(e, i18n);
      setError({ field, text: specific });
    } finally {
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={a.editTitle} onClose={onClose} testID="edit-profile">
      <View style={{ gap: space.md }}>
        <Field label={a.firstName} icon="user" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="given-name" error={error?.field === "firstName" ? error.text : null} testID="edit-first-name" />
        <Field label={a.lastName} icon="user" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="family-name" error={error?.field === "lastName" ? error.text : null} testID="edit-last-name" />
        {error && !["firstName", "lastName"].includes(error.field ?? "") ? (
          <Banner tone="error" testID="edit-error">
            {error.text}
          </Banner>
        ) : null}
        <PrimaryButton testID="edit-save" label={busy ? a.saving : i18n.t.common.save} onPress={save} loading={busy} />
      </View>
    </BottomSheet>
  );
}

/** Slett konto: bekreftes med passord (eller et ord for kontoer uten passord). */
function DeleteAccountSheet({ profile, visible, onClose }: { profile: CustomerProfile; visible: boolean; onClose: () => void }) {
  const { deleteAccount } = useApp();
  const i18n = useI18n();
  const a = i18n.t.account;
  const [password, setPassword] = useState("");
  const [word, setWord] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setError(null);
    if (profile.hasPassword && !password) return setError(a.passwordRequired);
    if (!profile.hasPassword && word.trim().toUpperCase() !== a.deleteWord) return setError(a.deleteWordMismatch(a.deleteWord));
    setBusy(true);
    try {
      await deleteAccount(profile.hasPassword ? { password } : { confirmation: a.deleteWord === "SLETT" ? "SLETT" : "DELETE" });
    } catch (e) {
      setError(
        e instanceof ApiError && e.code === "UNAUTHORIZED" && e.field === "password"
          ? a.deleteWrongPassword
          : e instanceof ApiError && e.code === "FORBIDDEN" && e.reason === "reauth_required"
            ? a.deleteReauth
            : errorText(e, i18n),
      );
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={a.deleteTitle} onClose={onClose} testID="delete-account">
      <View style={{ gap: space.md }}>
        <Text style={[type.callout, { color: colors.text }]}>{a.deleteBody}</Text>
        {profile.hasPassword ? (
          <Field label={a.deletePassword} icon="lock" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" autoComplete="current-password" testID="delete-password" />
        ) : (
          <Field label={a.deleteTypeWord(a.deleteWord)} icon="alert" value={word} onChangeText={setWord} autoCapitalize="characters" autoCorrect={false} testID="delete-word" />
        )}
        {error ? (
          <Banner tone="error" testID="delete-error">
            {error}
          </Banner>
        ) : null}
        <PrimaryButton testID="delete-confirm" label={busy ? a.deleting : a.deleteConfirm} onPress={confirm} loading={busy} />
        <SecondaryButton label={i18n.t.common.cancel} onPress={onClose} testID="delete-cancel" />
      </View>
    </BottomSheet>
  );
}

/**
 * Gjest, øverst i grafitten: tittelen, hva en konto er (samme konto som på hellosky.no) og at søket ikke krever den,
 * og de to valgene. Knappene står side om side når etikettene får plass, ellers under hverandre (stor tekst).
 * Skjemaet åpnes i et eget ark.
 */
function GuestIntro({ onLogin, onRegister }: { onLogin: () => void; onRegister: () => void }) {
  const { t } = useI18n();
  const a = t.account;
  return (
    <View style={styles.guest} testID="sign-in-card">
      <Text style={[type.hero, { color: colors.onDark }]} accessibilityRole="header">
        {a.profileTitle}
      </Text>
      <Text style={[type.callout, { color: colors.onDarkMuted }]}>{a.signInBody}</Text>
      <View style={styles.signInActions} testID="sign-in-actions">
        <View style={styles.signInAction}>
          {/* Like høy som «Opprett konto» (44 pt), så paret står på linje når de er side om side. */}
          <PrimaryButton testID="open-login" label={a.loginTitle} onPress={onLogin} accessibilityHint={a.signInHint} style={styles.pairButton} />
        </View>
        <View style={styles.signInAction}>
          <SecondaryButton dark testID="open-register" label={a.registerTitle} onPress={onRegister} accessibilityHint={a.registerHint} />
        </View>
      </View>
    </View>
  );
}

/**
 * Innlogget, øverst i grafitten: initialene (bare pynt – VoiceOver hører hilsenen), hilsenen og kontoens adresse. Uten
 * et ekte fornavn (tomt, eller serverens plassholder for Google/Apple uten navn – lib/customerName.ts) står «Du er
 * logget inn» i stedet for en hilsen, og sirkelen viser et ikon i stedet for initialer.
 */
function Identity({ profile }: { profile: CustomerProfile | null }) {
  const { t } = useI18n();
  const a = t.account;
  const name = greetingName(profile);
  const initials = `${(name ?? "").slice(0, 1)}${(profile?.lastName ?? "").trim().slice(0, 1)}`.toUpperCase();
  const address = profile ? (profile.email ?? profile.phone) : null;
  return (
    <View style={styles.identity}>
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {/* Pynt i en fast sirkel: vokser litt med stor tekst, men renner aldri ut (navnet står i full størrelse ved siden av). */}
        {initials ? (
          <Text style={styles.avatarText} maxFontSizeMultiplier={1.3}>
            {initials}
          </Text>
        ) : (
          <Icon name="user" size={24} color={colors.white} />
        )}
      </View>
      <View style={styles.identityText}>
        <Text style={[type.title, { color: colors.onDark }]} accessibilityRole="header">
          {name ? a.hello(name) : a.signedIn}
        </Text>
        {address ? <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{address}</Text> : null}
      </View>
    </View>
  );
}

/** Én flis i oversikten: et tall (eller en flyplasskode) og hva det er. Hele flisen er knappen, minst 72 pt høy. */
function HubTile({ value, label, accessibilityLabel, accessibilityHint, onPress, basis, testID }: { value: string; label: string; accessibilityLabel: string; accessibilityHint: string; onPress: () => void; basis: number; testID: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.tile, { flexBasis: basis }, pressed && { opacity: 0.7 }]}
    >
      <Text style={[type.title, type.tabular, { color: colors.onDark }]}>{value}</Text>
      {/* Ingen linjegrense: med stor tekst brytes etiketten, og flisene i raden blir like høye. */}
      <Text style={[type.footnote, { color: colors.onDarkMuted }]}>{label}</Text>
    </Pressable>
  );
}

/**
 * Oversikten øverst: nylige søk og lagrede reisemål på telefonen, og den vanlige avreiseflyplassen – tall som faktisk
 * ligger her, aldri anslag. Tre like fliser på én rad; med stor tekst trenger hver mer bredde, og raden brytes i stedet
 * for at et ord deles eller kuttes.
 */
function Overview() {
  const router = useRouter();
  const { recent, saved } = useApp();
  const { t, f } = useI18n();
  const a = t.account;
  const { fontScale } = useWindowDimensions();
  const home = useHomeAirport();
  const count = savedDestinations(saved).length;
  const basis = TILE_BASIS * Math.max(1, fontScale);
  return (
    <View style={styles.tiles} testID="hub-overview">
      <HubTile testID="hub-recent" value={f.int(recent.length)} label={a.hubRecent} accessibilityLabel={a.hubRecentLabel(recent.length)} accessibilityHint={a.hubOpensSaved} onPress={() => router.navigate("/lagret")} basis={basis} />
      <HubTile testID="hub-saved" value={f.int(count)} label={a.hubSaved} accessibilityLabel={a.hubSavedLabel(count)} accessibilityHint={a.hubOpensSaved} onPress={() => router.navigate("/lagret")} basis={basis} />
      <HubTile
        testID="hub-home-airport"
        value={home?.iata ?? "–"}
        label={a.hubHomeAirport}
        accessibilityLabel={a.homeAirportLabel(home?.text ?? null)}
        accessibilityHint={a.homeAirportHint}
        onPress={() => router.push(HOME_AIRPORT_PICKER)}
        basis={basis}
      />
    </View>
  );
}

/** Seksjonsoverskrift som i Lagret (små versaler) med «Se alle» til høyre; lenken sier til VoiceOver hvor den går. */
function SectionHead({ title, linkLabel, onPress, testID }: { title: string; linkLabel: string; onPress: () => void; testID: string }) {
  const { t } = useI18n();
  return (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle} accessibilityRole="header">
        {title}
      </Text>
      <LinkButton label={t.account.seeAll} accessibilityLabel={linkLabel} onPress={onPress} testID={testID} />
    </View>
  );
}

/**
 * Et nylig søk å fortsette: rute, flyplasskoder og det korte datospennet, reisende og klasse. Hele raden er én knapp;
 * VoiceOver hører hele datoene med ukedag, som på Hjem.
 */
function ContinueRow({ search: r, separated, onPress }: { search: RecentSearch; separated: boolean; onPress: () => void }) {
  const i18n = useI18n();
  const { t, f, locale } = i18n;
  const h = t.home;
  const route = `${localizedChoice(r.origin, locale).city} → ${localizedChoice(r.destination, locale).city}`;
  const back = r.tripType === "roundtrip" ? r.returnDate : null;
  // Synlig: det korte spennet («9.–16. okt.»), der hver dato holdes samlet; én vei sies, så raden ikke ser ut som en
  // tur-retur samme dag.
  const span = keepDatesTogether(f.dateSpan(r.departDate, back));
  const when = back ? span : `${h.oneway} · ${span}`;
  // «Bare direktefly» står med, så to søk som bare skiller seg der, aldri ser like ut.
  const people = [passengerSummary(r, i18n), cabinLabel(r.cabinClass, i18n), ...(r.directOnly ? [h.directOnly] : [])].join(" · ");
  const dates = back ? `${f.day(r.departDate)} – ${f.day(back)}` : `${h.oneway} · ${f.day(r.departDate)}`;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t.saved.searchAgainLabel(route, `${dates} · ${people}`)}
      accessibilityHint={h.recentHint}
      testID={`hub-recent-${r.origin.iata}-${r.destination.iata}-${r.departDate}`}
      style={({ pressed }) => [styles.continueRow, separated && styles.divider, pressed && styles.pressed]}
    >
      <View style={styles.continueIcon}>
        <Icon name="clock" size={18} color={colors.textSecondary} />
      </View>
      <View style={styles.continueText}>
        <Text style={[type.calloutStrong, { color: colors.text }]}>{route}</Text>
        {/* Nøyaktige flyplasskoder med ikke-brytende bindestrek (aldri «OSL–» / «BCN»), så datoene. */}
        <Text style={[type.footnote, { color: colors.text }]}>{`${r.origin.iata}\u2011${r.destination.iata} · ${when}`}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{people}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

/**
 * Modulene under oversikten, bare med det som finnes på telefonen: de tre nyeste søkene som fortsatt kan kjøres, og de
 * lagrede reisemålene som fotokort (et trykk søker dit, som på Hjem). Uten noe av det: et kort som forklarer hva som
 * havner her, med veien videre. Søk med passerte datoer står bare i Lagret (der de får nye datoer).
 */
function Hub({ onContinue, onSearchTo }: { onContinue: (r: RecentSearch) => void; onSearchTo: (d: Destination) => void }) {
  const router = useRouter();
  const { recent, saved } = useApp();
  const { t } = useI18n();
  const a = t.account;
  const today = new Date();
  const upcoming = recent.filter((r) => !recentIsPast(r, today)).slice(0, 3);
  const destinations = savedDestinations(saved);

  if (!upcoming.length && !destinations.length) {
    return (
      <View style={styles.startCard} testID="hub-start">
        <Text style={[type.section, { color: colors.text }]} accessibilityRole="header">
          {a.startTitle}
        </Text>
        <Text style={[type.callout, { color: colors.textSecondary }]}>{a.startBody}</Text>
        <View style={styles.startLinks}>
          <LinkButton label={a.startSearch} onPress={() => router.navigate("/")} testID="hub-start-search" />
          <LinkButton label={a.startExplore} onPress={() => router.navigate("/utforsk")} testID="hub-start-explore" />
        </View>
      </View>
    );
  }

  return (
    <>
      {upcoming.length ? (
        <View style={styles.module} testID="hub-continue">
          <SectionHead title={a.continueTitle} linkLabel={a.continueAllLabel} onPress={() => router.navigate("/lagret")} testID="hub-continue-all" />
          {/* Én hvit gruppe med tynne skiller – ikke et stort kort per rad. */}
          <View style={styles.list}>
            {upcoming.map((r, i) => (
              <ContinueRow key={recentKey(r)} search={r} separated={i > 0} onPress={() => onContinue(r)} />
            ))}
          </View>
        </View>
      ) : null}
      {destinations.length ? (
        <View style={styles.module} testID="hub-saved-destinations">
          <SectionHead title={a.hubSaved} linkLabel={a.savedAllLabel} onPress={() => router.navigate("/lagret")} testID="hub-saved-all" />
          {/* Raden går ut til skjermkantene og ruller under dem; første og siste kort står på sidemargen. */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rail} contentContainerStyle={styles.railContent} testID="hub-saved-rail">
            {destinations.map((d) => (
              <DestinationCard key={d.id} destination={d} onPress={() => onSearchTo(d)} testID={`hub-saved-${d.id}`} />
            ))}
          </ScrollView>
        </View>
      ) : null}
    </>
  );
}

/**
 * Min side: kundens egen side i appen. Øverst en grafittøy helt opp under statuslinjen med hilsenen – eller
 * innloggingen for gjester – og en oversikt over det som ligger på telefonen. Under, på den lyse grunnen: søk å
 * fortsette og lagrede reisemål (eller «Kom i gang»), reisevaner, kontoen og sidene på hellosky.no (innlogget),
 * innstillinger, hjelp og versjonen. Vanlig kundeinnlogging; ingen andre roller finnes i appen.
 */
export default function AccountScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { auth, logout, requestSocialProviders, form, setForm, runSearch } = useApp();
  const i18n = useI18n();
  const { t, locale } = i18n;
  const a = t.account;
  // Innloggingsskjemaet står i et eget ark (iOS' sidekort) som åpnes fra toppen, i innlogging eller ny konto.
  const [authOpen, setAuthOpen] = useState<SignInMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState<null | "edit" | "delete">(null);
  const [profileSaved, setProfileSaved] = useState(false);
  // Et søk fra siden som ikke kan kjøres (f.eks. samme flyplass begge veier). Feilen gjelder skjemaet slik det var da
  // kunden trykket; endres det siden (på Hjem, i Utforsk), er den borte – som i Utforsk.
  const [problem, setProblem] = useState<{ code: FormErrorCode; key: string } | null>(null);
  const [heroHeight, setHeroHeight] = useState(0);
  const [pastHero, setPastHero] = useState(false);

  // Et ark eller en «lagret»-melding hører til kontoen som var logget inn da:
  // etter utlogging, sletting eller utløpt økt skal ingenting dukke opp igjen.
  // Den nye siden starter øverst (egen rulleflate), under grafitten og uten en gammel søkefeil.
  // (Innloggingsarket rydder sitt eget skjema, også passordet – se components/SignInSheet.tsx.)
  const [shownFor, setShownFor] = useState(auth.status);
  if (shownFor !== auth.status) {
    setShownFor(auth.status);
    setSheet(null);
    setProfileSaved(false);
    setAuthOpen(null);
    setProblem(null);
    setPastHero(false);
  }

  // Innloggingsmåtene (Google/Apple) hentes bare når innloggingen faktisk kan vises.
  const signedOut = auth.status === "signedOut";
  useEffect(() => {
    if (signedOut) requestSocialProviders();
  }, [signedOut, requestSocialProviders]);

  // Innloggingsarket står i alle tilstander med samme nøkkel, så det beholder skjemaet (e-postadressen står til neste
  // gang, også etter innlogging og utlogging). Det vises bare for gjester.
  const signIn = <SignInSheet key="sign-in-sheet" visible={authOpen !== null} initialMode={authOpen ?? "login"} onClose={() => setAuthOpen(null)} />;

  if (auth.status === "loading") {
    return (
      <View style={[styles.screen, styles.center]}>
        <FocusStatusBar style="dark" />
        <ActivityIndicator color={colors.text} />
        {signIn}
      </View>
    );
  }

  // Et søk som ikke kan kjøres, prøves før runSearch – den skriver endringen inn i skjemaet før den sjekker, og et trykk
  // som ikke fører noe sted, skal ikke bytte ut reisen kunden holder på med. Skjemaet står urørt, og feilen står over
  // modulene (kanskje utenfor bildet der kunden trykket), så VoiceOver leser den opp med én gang.
  const searchFailed = (code: FormErrorCode) => {
    setProblem({ code, key: recentKey(form) });
    AccessibilityInfo.announceForAccessibility(formErrorText(code, i18n));
  };
  const continueSearch = (r: RecentSearch) => {
    // Datoene kan ha passert siden raden ble tegnet (appen sto åpen over midnatt): da får skjemaet på Hjem ruten med
    // nye datoer å se på – som «Velg nye datoer» i Lagret – i stedet for et søk som ikke kan kjøres.
    if (recentIsPast(r)) {
      setForm(() => withFreshDates(r));
      setProblem(null);
      router.navigate("/");
      return;
    }
    const err = validateForm(r) ?? runSearch(r);
    if (err) return searchFailed(err);
    setProblem(null);
    router.push("/resultater");
  };
  const searchTo = (d: Destination) => {
    const destination = destinationChoice(d, locale);
    const err = validateForm({ ...form, destination }) ?? runSearch({ destination });
    if (err) return searchFailed(err);
    setProblem(null);
    router.push("/resultater");
  };
  const shownProblem = problem && problem.key === recentKey(form) ? problem.code : null;

  const signedIn = auth.status === "signedIn";
  const p = auth.status === "signedIn" ? auth.profile : null;
  const notice = auth.status === "signedOut" ? auth.notice : undefined;

  return (
    <View style={styles.screen}>
      {/* Lys tekst mens grafitten ligger under statuslinjen; rullet forbi øya: mørk tekst på en lys skjerm. */}
      <FocusStatusBar style={pastHero ? "dark" : "light"} animated />
      {/* Egen nøkkel per tilstand: etter innlogging, utlogging, sletting eller utløpt økt starter siden øverst. */}
      <ScrollView
        key={signedIn ? "signed-in" : "signed-out"}
        testID={signedIn ? "account-signed-in" : "account-signed-out"}
        style={styles.screen}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const past = heroHeight > 0 && e.nativeEvent.contentOffset.y > heroHeight - insets.top;
          if (past !== pastHero) setPastHero(past);
        }}
      >
        <View style={[styles.hero, { paddingTop: insets.top + space.lg }]} testID="account-hero" onLayout={(e) => setHeroHeight(e.nativeEvent.layout.height)}>
          {/* Grafitten fortsetter over toppen, så et drag nedover (iOS' sprett) aldri viser lys grunn bak statuslinjen. */}
          <View style={styles.heroBleed} pointerEvents="none" />
          {signedIn ? <Identity profile={p} /> : <GuestIntro onLogin={() => setAuthOpen("login")} onRegister={() => setAuthOpen("register")} />}
          <Overview />
        </View>

        <View style={styles.content}>
          {notice ? (
            <Banner tone={notice === "expired" ? "warning" : "info"} testID={`auth-notice-${notice}`}>
              {notice === "expired" ? a.sessionExpired : a.deleted}
            </Banner>
          ) : null}
          {shownProblem ? (
            <Banner tone="error" testID="hub-error">
              {formErrorText(shownProblem, i18n)}
            </Banner>
          ) : null}
          <Hub onContinue={continueSearch} onSearchTo={searchTo} />
          <PreferencesGroup />
          {signedIn ? (
            <>
              {/* Meldingen står ved kontoen, der kunden er når arket lukkes. */}
              {profileSaved ? (
                <Banner tone="info" testID="profile-saved">
                  {a.saved}
                </Banner>
              ) : null}
              {p ? (
                <Group title={a.accountSection} testID="account-card">
                  {/* Verdien øverst og hva den er under, så lange navn og e-poster får hele bredden. */}
                  <Row icon="user" title={`${p.firstName} ${p.lastName}`.trim()} subtitle={a.nameLabel} accessibilityLabel={`${a.nameLabel}: ${`${p.firstName} ${p.lastName}`.trim()}`} />
                  {p.email ? <Row icon="mail" title={p.email} subtitle={a.emailLabel} accessibilityLabel={`${a.emailLabel}: ${p.email}`} separated /> : null}
                  {p.phone ? <Row icon="phone" title={p.phone} subtitle={a.phoneLabel} accessibilityLabel={`${a.phoneLabel}: ${p.phone}`} separated /> : null}
                  <Row
                    icon="pencil"
                    title={a.editProfile}
                    separated
                    onPress={() => {
                      setProfileSaved(false);
                      setSheet("edit");
                    }}
                    testID="open-edit-profile"
                  />
                </Group>
              ) : (
                <Banner tone="warning">{a.profileUnavailable}</Banner>
              )}
              <WebAccountGroup />
            </>
          ) : null}
          <SettingsGroup />
          <HelpGroup />
          {signedIn ? (
            <Group>
              <Row
                icon="logout"
                title={busy ? a.loggingOut : a.logout}
                action
                testID="logout-button"
                onPress={async () => {
                  if (busy) return;
                  setBusy(true);
                  await logout();
                  setBusy(false);
                }}
              />
              {p ? <Row icon="close" title={a.deleteRow} danger action separated onPress={() => setSheet("delete")} testID="open-delete-account" /> : null}
            </Group>
          ) : null}
          <VersionLine />
          {p ? (
            <>
              <EditProfileSheet
                key={`edit-${sheet === "edit"}`}
                profile={p}
                visible={sheet === "edit"}
                onClose={() => setSheet(null)}
                onSaved={() => {
                  setSheet(null);
                  setProfileSaved(true);
                }}
              />
              <DeleteAccountSheet key={`delete-${sheet === "delete"}`} profile={p} visible={sheet === "delete"} onClose={() => setSheet(null)} />
            </>
          ) : null}
        </View>
      </ScrollView>
      <StatusBarShield visible={pastHero} tone="light" />
      {signIn}
    </View>
  );
}

const styles = StyleSheet.create({
  // «Cloud + Graphite»: lys grunn; grafitt bare i øya øverst. Overskrifter i `text`, hjelpetekst i `textSecondary`.
  screen: { flex: 1, backgroundColor: colors.canvas },
  center: { alignItems: "center", justifyContent: "center" },
  // Grafittøya går helt ut til kantene og opp under statuslinjen, med runde hjørner nederst.
  hero: { backgroundColor: colors.raised, borderBottomLeftRadius: radius.sheet, borderBottomRightRadius: radius.sheet, paddingHorizontal: space.lg, paddingBottom: space.xl, gap: space.lg },
  heroBleed: { position: "absolute", left: 0, right: 0, bottom: "100%", height: 1000, backgroundColor: colors.raised },
  identity: { flexDirection: "row", alignItems: "center", gap: space.md },
  identityText: { flex: 1, gap: 2 },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.blue, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 20, lineHeight: 24, fontWeight: "700", color: colors.white },
  guest: { gap: space.sm },
  // Side om side når begge etikettene får plass på én linje; ellers brytes raden, og hver knapp får hele bredden.
  signInActions: { flexDirection: "row", flexWrap: "wrap", gap: space.sm, marginTop: space.sm },
  signInAction: { flexGrow: 1, minWidth: 140 },
  pairButton: { minHeight: TOUCH },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: space.sm },
  tile: { flexGrow: 1, flexShrink: 1, minHeight: 72, padding: space.md, gap: 2, borderRadius: radius.input, backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.darkBorder },
  content: { paddingHorizontal: space.lg, paddingTop: space.xl, paddingBottom: space.xxxl, gap: space.xl },
  module: { gap: 0 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH },
  sectionTitle: { ...type.footnoteStrong, flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: 0.6 },
  // Én hvit gruppe med tynne skiller, som i Lagret.
  list: { borderRadius: radius.input, backgroundColor: colors.white, overflow: "hidden" },
  continueRow: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 64, paddingVertical: space.sm, paddingHorizontal: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  pressed: { backgroundColor: colors.inset },
  continueIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.inset, alignItems: "center", justifyContent: "center" },
  continueText: { flex: 1, gap: 1 },
  // Fotokortene: raden oppheves ut over sidemargen (kant til kant), og innholdet legges tilbake på margen.
  rail: { flexGrow: 0, marginHorizontal: -space.lg },
  railContent: { paddingHorizontal: space.lg, gap: space.md },
  // «Kom i gang»: samme hvite flate som gruppene; lenkene er selv 44 pt høye og trenger ingen ekstra luft under seg.
  startCard: { backgroundColor: colors.white, borderRadius: radius.input, paddingHorizontal: space.lg, paddingTop: space.lg, paddingBottom: space.xs, gap: space.xs },
  startLinks: { flexDirection: "row", flexWrap: "wrap", columnGap: space.xl },
  // Innstillingslisten: overskrift på grunnen, hvitt kort med rader og hårfine streker mellom dem.
  group: { gap: space.sm },
  // Like langt fra overskriften til kortet som i modulene (der «Se alle» gjør overskriftsraden 44 pt høy).
  groupTitle: { ...type.footnoteStrong, color: colors.text, textTransform: "uppercase", letterSpacing: 0.6, marginBottom: space.xs },
  groupCard: { backgroundColor: colors.white, borderRadius: radius.input, overflow: "hidden" },
  row: { minHeight: TOUCH + 8, flexDirection: "row", alignItems: "center", gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  rowText: { flex: 1, gap: 2 },
  // Verdien tar aldri mer enn litt over halve raden, så etiketten ikke presses til ingenting (lange verdier bryter).
  rowValue: { color: colors.textSecondary, flexShrink: 1, maxWidth: "55%", textAlign: "right" },
  block: { paddingHorizontal: space.lg, paddingVertical: space.md, gap: space.md },
  blockHead: { flexDirection: "row", alignItems: "center", gap: space.md },
  version: { color: colors.textSecondary, textAlign: "center" },
});
