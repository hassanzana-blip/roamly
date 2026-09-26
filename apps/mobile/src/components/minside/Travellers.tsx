import { useState } from "react";
import { AccessibilityInfo, StyleSheet, View } from "react-native";
import * as Crypto from "expo-crypto";
import type { CabinClass } from "@contracts/types";
import { Pressable, Text } from "../a11y";
import { Icon } from "../Icon";
import { Banner, BottomSheet, ChoiceChips, Field, LinkButton, PrimaryButton, SecondaryButton } from "../ui";
import { useApp } from "../../lib/appState";
import { useAccountData } from "../../lib/accountData";
import { ApiError } from "../../lib/api";
import { errorText } from "../../lib/errorText";
import { CABINS } from "../../lib/searchForm";
import { MAX_TRAVELLERS, TRAVELLER_KINDS, travellerInitials, travellerNameProblem, type TravellerKind } from "../../lib/travellers";
import { useI18n } from "../../i18n";
import { colors, radius, space, TOUCH, type } from "../../lib/theme";

/** Én rad i listen, fra telefonen (id: tekst) eller kontoen (id: tall). */
type Item = { key: string; accountId: number | null; localId: string | null; firstName: string; lastName: string; kind: TravellerKind | null; cabin: CabinClass | null };

/** Kontoens grense (serveren) og telefonens. */
const ACCOUNT_MAX = 20;

/**
 * Reisende på Min side: navn, type (voksen, barn, spedbarn) og ev. foretrukket reiseklasse – aldri pass, ID-nummer
 * eller personnummer. Innlogget med en server som har kontoens reisende (mobileAccount), er listen kontoens (de samme
 * som på hellosky.no); ellers ligger den bare på telefonen. Reisende på telefonen kan flyttes til kontoen med ett trykk.
 */
export function TravellersSection() {
  const { travellers: local, saveTraveller: saveLocal, removeTraveller: removeLocal, auth } = useApp();
  const account = useAccountData();
  const i18n = useI18n();
  const h = i18n.t.hub;
  const onAccount = auth.status === "signedIn" && account.status === "ready" && account.travellers !== null;
  const items: Item[] = onAccount
    ? (account.travellers ?? []).map((t) => ({ key: `a${t.id}`, accountId: t.id, localId: null, firstName: t.firstName, lastName: t.lastName, kind: t.kind, cabin: t.cabin }))
    : local.map((t) => ({ key: `l${t.id}`, accountId: null, localId: t.id, firstName: t.firstName, lastName: t.lastName, kind: t.kind, cabin: t.cabin }));
  const max = onAccount ? ACCOUNT_MAX : MAX_TRAVELLERS;
  const [editing, setEditing] = useState<Item | "new" | null>(null);
  const [moving, setMoving] = useState(false);
  const [moveError, setMoveError] = useState(false);

  const moveToAccount = async () => {
    setMoving(true);
    setMoveError(false);
    let failed = false;
    for (const t of local) {
      try {
        await account.saveTraveller({ firstName: t.firstName, lastName: t.lastName, kind: t.kind, cabin: t.cabin });
        removeLocal(t.id);
      } catch {
        failed = true;
      }
    }
    setMoving(false);
    if (failed) {
      setMoveError(true);
      AccessibilityInfo.announceForAccessibility(h.moveFailed);
    }
  };

  return (
    <View style={styles.module} testID="travellers-section">
      <View style={styles.head}>
        <Text style={styles.title} accessibilityRole="header">
          {h.travellersTitle}
        </Text>
        {items.length && items.length < max ? <LinkButton label={h.addTraveller} onPress={() => setEditing("new")} testID="traveller-add" /> : null}
      </View>
      {items.length ? (
        <View style={styles.list} testID="traveller-list">
          {items.map((t, i) => (
            <TravellerRow key={t.key} item={t} separated={i > 0} onPress={() => setEditing(t)} />
          ))}
        </View>
      ) : (
        <View style={styles.empty} testID="travellers-empty">
          <View style={styles.emptyIcon}>
            <Icon name="users" size={20} color={colors.blue} />
          </View>
          <Text style={[type.callout, { color: colors.text }]}>{h.travellersEmpty}</Text>
          <SecondaryButton label={h.addTraveller} icon="plus" onPress={() => setEditing("new")} testID="traveller-add-first" />
        </View>
      )}
      <Text style={[type.footnote, { color: colors.textSecondary }]} testID="travellers-note">
        {onAccount ? h.travellersAccount : h.travellersDevice}
      </Text>
      {onAccount && local.length ? (
        <View style={styles.move} testID="travellers-move">
          <Text style={[type.footnote, { color: colors.text, flex: 1 }]}>{h.travellersDeviceWhileSignedIn(local.length)}</Text>
          <LinkButton label={moving ? h.moving : h.moveToAccount} onPress={() => (moving ? undefined : void moveToAccount())} testID="travellers-move-button" />
        </View>
      ) : null}
      {moveError ? (
        <Banner tone="warning" testID="travellers-move-error">
          {h.moveFailed}
        </Banner>
      ) : null}
      <TravellerSheet
        key={editing === null ? "closed" : editing === "new" ? "new" : editing.key}
        item={editing === "new" ? null : editing}
        visible={editing !== null}
        onClose={() => setEditing(null)}
        full={items.length >= max}
        max={max}
        onSave={async (v) => {
          if (onAccount) {
            await account.saveTraveller({ ...(editing !== "new" && editing?.accountId ? { id: editing.accountId } : {}), ...v });
          } else {
            saveLocal({ id: editing !== "new" && editing?.localId ? editing.localId : Crypto.randomUUID(), ...v });
          }
        }}
        onRemove={
          editing && editing !== "new"
            ? async () => {
                if (editing.accountId) await account.removeTraveller(editing.accountId);
                else if (editing.localId) removeLocal(editing.localId);
              }
            : null
        }
      />
    </View>
  );
}

function TravellerRow({ item, separated, onPress }: { item: Item; separated: boolean; onPress: () => void }) {
  const i18n = useI18n();
  const h = i18n.t.hub;
  const name = `${item.firstName} ${item.lastName}`;
  const kind = item.kind ? h.kindShort[item.kind] : h.kindUnknown;
  const cabin = item.cabin ? i18n.t.search.cabins[item.cabin] : null;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={h.travellerLabel(name, kind, cabin)}
      accessibilityHint={h.editHint}
      testID={`traveller-${item.key}`}
      style={({ pressed }) => [styles.row, separated && styles.divider, pressed && { backgroundColor: colors.inset }]}
    >
      <View style={styles.avatar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Text style={styles.avatarText} maxFontSizeMultiplier={1.3}>
          {travellerInitials(item)}
        </Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[type.calloutStrong, { color: colors.text }]}>{name}</Text>
        <Text style={[type.footnote, { color: colors.textSecondary }]}>{[kind, cabin].filter(Boolean).join(" · ")}</Text>
      </View>
      <Icon name="chevronRight" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

type Values = { firstName: string; lastName: string; kind: TravellerKind; cabin: CabinClass | null };

/** Ny eller endret reisende i et ark. Navnet sjekkes som kontoens navn; serverfeil vises i arket. */
function TravellerSheet({ item, visible, onClose, onSave, onRemove, full, max }: { item: Item | null; visible: boolean; onClose: () => void; onSave: (v: Values) => Promise<void>; onRemove: (() => Promise<void>) | null; full: boolean; max: number }) {
  const i18n = useI18n();
  const { t } = i18n;
  const h = t.hub;
  const [firstName, setFirstName] = useState(item?.firstName ?? "");
  const [lastName, setLastName] = useState(item?.lastName ?? "");
  const [kind, setKind] = useState<TravellerKind>(item?.kind ?? "adult");
  const [cabin, setCabin] = useState<CabinClass | "none">(item?.cabin ?? "none");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ field: "firstName" | "lastName" | null; text: string } | null>(null);
  const isNew = item === null;

  const save = async () => {
    setError(null);
    const problem = travellerNameProblem(firstName, lastName);
    if (problem) return setError({ field: problem, text: t.account.fieldErrors[problem] });
    if (isNew && full) return setError({ field: null, text: h.travellerLimit(max) });
    setBusy(true);
    try {
      await onSave({ firstName: firstName.trim(), lastName: lastName.trim(), kind, cabin: cabin === "none" ? null : cabin });
      onClose();
    } catch (e) {
      const field = e instanceof ApiError && (e.field === "firstName" || e.field === "lastName") ? e.field : null;
      setError({ field, text: field ? t.account.fieldErrors[field] : e instanceof ApiError && e.reason === "limit" ? h.travellerLimit(ACCOUNT_MAX) : errorText(e, i18n) });
      setBusy(false);
    }
  };
  const remove = async () => {
    if (!onRemove) return;
    setBusy(true);
    try {
      await onRemove();
      onClose();
    } catch (e) {
      setError({ field: null, text: errorText(e, i18n) });
      setBusy(false);
    }
  };

  return (
    <BottomSheet visible={visible} title={isNew ? h.newTraveller : h.editTraveller} onClose={onClose} testID="traveller-sheet">
      <View style={{ gap: space.md }}>
        <Field label={t.account.firstName} icon="user" value={firstName} onChangeText={setFirstName} textContentType="givenName" autoComplete="off" error={error?.field === "firstName" ? error.text : null} testID="traveller-first-name" />
        <Field label={t.account.lastName} icon="user" value={lastName} onChangeText={setLastName} textContentType="familyName" autoComplete="off" error={error?.field === "lastName" ? error.text : null} testID="traveller-last-name" />
        <View style={{ gap: space.xs }}>
          <Text style={[type.footnoteStrong, { color: colors.text }]}>{h.kind}</Text>
          <ChoiceChips<TravellerKind> label={h.kind} value={kind} options={TRAVELLER_KINDS} onChange={setKind} format={(k) => h.kinds[k]} testIDPrefix="traveller-kind-" />
        </View>
        <View style={{ gap: space.xs }}>
          <Text style={[type.footnoteStrong, { color: colors.text }]}>{h.travellerCabin}</Text>
          <ChoiceChips<CabinClass | "none"> label={h.travellerCabin} value={cabin} options={["none", ...CABINS]} onChange={setCabin} format={(c) => (c === "none" ? h.noCabin : t.search.cabins[c])} testIDPrefix="traveller-cabin-" />
        </View>
        <View style={styles.privacy} testID="traveller-privacy">
          <Icon name="lock" size={16} color={colors.textSecondary} />
          <Text style={[type.footnote, { color: colors.textSecondary, flex: 1 }]}>{h.travellerPrivacy}</Text>
        </View>
        {error && !error.field ? (
          <Banner tone="error" testID="traveller-error">
            {error.text}
          </Banner>
        ) : null}
        <PrimaryButton label={busy ? t.account.saving : t.common.save} onPress={save} loading={busy} testID="traveller-save" />
        {onRemove ? <LinkButton label={h.removeTraveller} accessibilityLabel={h.removeTravellerLabel(`${item?.firstName} ${item?.lastName}`)} onPress={() => void remove()} testID="traveller-remove" /> : null}
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  module: { gap: space.sm },
  head: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: TOUCH },
  title: { ...type.footnoteStrong, flex: 1, color: colors.text, textTransform: "uppercase", letterSpacing: 0.6 },
  list: { borderRadius: radius.input, backgroundColor: colors.white, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingVertical: space.sm, paddingHorizontal: space.md },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lightBorder },
  rowText: { flex: 1, gap: 1 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, lineHeight: 20, fontWeight: "700", color: colors.blue },
  empty: { gap: space.md, padding: space.lg, borderRadius: radius.input, backgroundColor: colors.white },
  emptyIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.blueSoft, alignItems: "center", justifyContent: "center" },
  move: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: space.sm, paddingHorizontal: space.md, borderRadius: radius.input, backgroundColor: colors.surfaceSoft, borderWidth: 1, borderColor: colors.lightBorder },
  privacy: { flexDirection: "row", gap: space.sm, alignItems: "flex-start" },
});
