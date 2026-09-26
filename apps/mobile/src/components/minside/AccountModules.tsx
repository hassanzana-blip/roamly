import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { Pressable, Text } from "../a11y";
import { Icon } from "../Icon";
import { Group, Row } from "../SettingsList";
import { useApp } from "../../lib/appState";
import { useAccountData } from "../../lib/accountData";
import { WEB_PAGES } from "../../lib/config";
import { formatTime, keepDatesTogether } from "../../lib/format";
import { flightIsPast } from "../../lib/savedTrips";
import { useI18n } from "../../i18n";
import { colors, radius, space, type } from "../../lib/theme";

/** Nettsidene åpnes i Safari-visning, som tilbydernes sider. */
export function openWeb(url: string) {
  WebBrowser.openBrowserAsync(url, { controlsColor: colors.blue, dismissButtonStyle: "close" }).catch(() => undefined);
}

/**
 * «Neste reise»: den nærmeste bestillingen på kontoen (mobileAccount.hub, bestilt på hellosky.no) – eller, uten en
 * slik, det neste flyet kunden har lagret, tydelig merket «Lagret – ikke bestilt». Uten noen av delene: ingenting (ingen
 * tom plassholder, ingen oppdiktet reise).
 */
export function NextTrip() {
  const router = useRouter();
  const { savedFlights } = useApp();
  const account = useAccountData();
  const { t, f } = useI18n();
  const h = t.hub;
  const trip = account.status === "ready" ? account.hub?.nextTrip : null;

  if (trip) {
    const route = `${trip.originCity || trip.originIata} → ${trip.destinationCity || trip.destinationIata}`;
    const dates = keepDatesTogether(f.dateSpan(trip.departingAt.slice(0, 10), trip.returningAt ? trip.returningAt.slice(0, 10) : null));
    const more = (account.hub?.upcomingTrips ?? 1) - 1;
    return (
      <Pressable
        onPress={() => openWeb(WEB_PAGES.trips)}
        accessibilityRole="link"
        accessibilityLabel={h.nextTripLabel(route, dates, trip.bookingReference)}
        accessibilityHint={h.openTripHint}
        testID="next-trip"
        style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
      >
        <View style={styles.cardHead}>
          <Text style={styles.eyebrow}>{h.nextTripTitle}</Text>
          <View style={[styles.badge, { backgroundColor: colors.successSoft }]}>
            <Icon name="check" size={14} color={colors.success} />
            <Text style={[type.footnoteStrong, { color: colors.success }]}>{h.bookedOnWeb}</Text>
          </View>
        </View>
        <Text style={[type.title, { color: colors.text }]}>{route}</Text>
        <Text style={[type.callout, { color: colors.text }]}>{`${trip.originIata}‑${trip.destinationIata} · ${dates}`}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{`${h.bookingRef(trip.bookingReference)} · ${h.passengers(trip.passengerCount)}`}</Text>
        <View style={styles.cardFoot}>
          <Text style={[type.footnoteStrong, { color: colors.blue, flex: 1 }]}>{h.openTrip}</Text>
          <Icon name="external" size={16} color={colors.blue} />
        </View>
        {more > 0 ? <Text style={[type.footnote, { color: colors.textSecondary }]}>{h.moreTrips(more)}</Text> : null}
      </Pressable>
    );
  }

  const next = savedFlights
    .filter((s) => !flightIsPast(s))
    .sort((a, b) => (a.legs[0]?.departingAt ?? "").localeCompare(b.legs[0]?.departingAt ?? ""))[0];
  const out = next?.legs[0];
  if (!next || !out) return null;
  const back = next.legs[1];
  const route = `${out.origin.city} → ${out.destination.city}`;
  const dates = keepDatesTogether(f.dateSpan(out.departingAt.slice(0, 10), back ? back.departingAt.slice(0, 10) : null));
  return (
    <Pressable
      onPress={() => router.navigate({ pathname: "/lagret", params: { vis: "fly" } })}
      accessibilityRole="button"
      accessibilityLabel={h.nextSavedLabel(route, dates)}
      testID="next-saved-flight"
      style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}
    >
      <View style={styles.cardHead}>
        <Text style={styles.eyebrow}>{h.nextSavedTitle}</Text>
        <View style={[styles.badge, { backgroundColor: colors.inset }]}>
          <Icon name="bookmark" size={14} color={colors.textSecondary} />
          <Text style={[type.footnoteStrong, { color: colors.textSecondary }]}>{h.notBooked}</Text>
        </View>
      </View>
      <Text style={[type.title, { color: colors.text }]}>{route}</Text>
      <Text style={[type.callout, { color: colors.text }]}>{`${out.origin.iata}‑${out.destination.iata} · ${dates}`}</Text>
      <Text style={[type.footnote, { color: colors.textSecondary }]}>{`${formatTime(out.departingAt)}–${formatTime(out.arrivingAt)} · ${out.carriers.map((c) => c.name).join(", ")} · ${f.stops(out.stops)}`}</Text>
      <View style={styles.cardFoot}>
        <Text style={[type.footnoteStrong, { color: colors.blue, flex: 1 }]}>{h.savedFlightOpen}</Text>
        <Icon name="chevronRight" size={16} color={colors.blue} />
      </View>
    </Pressable>
  );
}

/**
 * Varsler (innlogget): prisvarsler og meldinger på kontoen – med antall når kontoen svarte, ellers bare lenkene – og
 * e-post- og varselvalgene på hellosky.no. Appen sender ikke pushvarsler; det står her i stedet for en bryter som ikke
 * gjør noe.
 */
export function AlertsGroup() {
  const account = useAccountData();
  const { t } = useI18n();
  const h = t.hub;
  const hub = account.status === "ready" ? account.hub : null;
  return (
    <Group title={h.alertsTitle} testID="alerts-group" note={h.pushNote}>
      <Row icon="bell" title={h.priceWatches} subtitle={h.priceWatchesNote} value={hub ? h.priceWatchesValue(hub.priceWatches) : null} external onPress={() => openWeb(WEB_PAGES.priceWatches)} testID="link-price-alerts" accessibilityHint={t.account.webOpens} />
      <Row icon="mail" title={h.inbox} value={hub ? h.inboxValue(hub.unreadNotifications) : null} external separated onPress={() => openWeb(WEB_PAGES.notifications)} testID="link-inbox" accessibilityHint={t.account.webOpens} />
      <Row icon="pencil" title={h.emailPrefs} external separated onPress={() => openWeb(WEB_PAGES.notificationSettings)} testID="link-notification-settings" accessibilityHint={t.account.webOpens} />
    </Group>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.xs, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.lightBorder },
  cardHead: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, marginBottom: space.xs },
  eyebrow: { ...type.footnoteStrong, flex: 1, color: colors.textSecondary, textTransform: "uppercase", letterSpacing: 0.6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: radius.pill },
  cardFoot: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 32, marginTop: space.xs },
});
