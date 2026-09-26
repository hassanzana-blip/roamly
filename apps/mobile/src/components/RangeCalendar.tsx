import { memo, useCallback, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "./a11y";
import { BottomSheet } from "./ui";
import { applyPick, dayRole, monthGrid, monthIndexOf, monthsFrom, nightsBetween, todayIso, type DayRole, type Month, type PickMode } from "../lib/calendar";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

const SIDE = space.xl;
/** Smale skjermer (320 pt): rutenettet går nesten ut til kanten, så hver dag fortsatt er minst 44 pt bred. */
const NARROW_SIDE = 6;
/** Dagtall og månedsnavn vokser med tekststørrelsen opp til det dobbelte; større ville ikke fått plass i sju kolonner. */
const SCALE_MAX = 2;

/** Radhøyden: minst 44 pt, og høyere når dagtallet blir stort. */
function rowHeight(fontScale: number): number {
  return Math.max(TOUCH + 2, Math.ceil(21 * Math.min(fontScale, SCALE_MAX) + 12));
}

/** Månedsnavnets høyde (tekstlinjen pluss luft over), så det aldri klippes med stor tekst. */
function monthHeadHeight(fontScale: number): number {
  return Math.ceil(22 * Math.min(fontScale, SCALE_MAX)) + space.lg;
}

type Dates = { departDate: string; returnDate: string };

/** Én dag: tallet, og for valget en blå sirkel (avreise/retur) og et lyseblått bånd mellom dem. */
const Day = memo(function Day({ iso, size, row, role, today, past, sets, onPick }: { iso: string; size: number; row: number; role: DayRole; today: boolean; past: boolean; sets: PickMode; onPick: (iso: string) => void }) {
  const { t, f } = useI18n();
  const c = t.calendar;
  const selected = role === "depart" || role === "return" || role === "same";
  const day = Number(iso.slice(8, 10));
  const spoken = [f.longDay(iso), role ? c.roles[role] : null, today ? c.today : null, past ? c.past : null].filter(Boolean).join(", ");
  const dot = Math.min(size, row) - 4;
  return (
    <Pressable
      testID={`day-${iso}`}
      onPress={() => onPick(iso)}
      disabled={past}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      // Hva et trykk faktisk gjør: en dag før avreisen blir ny avreise, også når kalenderen venter på retur.
      accessibilityHint={past ? undefined : sets === "return" ? c.hintReturn : c.hintDepart}
      accessibilityState={{ selected, disabled: past }}
      style={[styles.cell, { width: size, height: row }]}
    >
      {/* Båndet mellom avreise og retur: hele cellen innimellom, halve ved endene. */}
      {role === "inside" ? <View style={[styles.band, { left: 0, right: 0 }]} /> : null}
      {role === "depart" ? <View style={[styles.band, { left: size / 2, right: 0 }]} testID={`band-${iso}`} /> : null}
      {role === "return" ? <View style={[styles.band, { left: 0, right: size / 2 }]} /> : null}
      <View style={[styles.dot, { width: dot, height: dot, borderRadius: dot / 2 }, selected && styles.dotSelected, today && !selected && styles.today]}>
        <Text style={[styles.dayText, type.tabular, past && styles.past, selected && styles.dayTextSelected, role === "inside" && { color: colors.blue }]} maxFontSizeMultiplier={SCALE_MAX}>
          {day}
        </Text>
      </View>
    </Pressable>
  );
});

/** En måned: navnet og ukene. Tomme plasser før den første og etter den siste dagen. */
const MonthView = memo(function MonthView({ month, cell, row, head, departDate, returnDate, today, mode, onPick }: { month: Month; cell: number; row: number; head: number; departDate: string; returnDate: string | null; today: string; mode: PickMode; onPick: (iso: string) => void }) {
  const { f } = useI18n();
  const weeks = useMemo(() => monthGrid(month), [month]);
  return (
    <View testID={`month-${month.year}-${month.month0 + 1}`}>
      <View style={[styles.monthHead, { height: head }]}>
        <Text style={[type.bodyStrong, styles.monthName]} accessibilityRole="header" maxFontSizeMultiplier={SCALE_MAX}>
          {f.monthYear(month.year, month.month0)}
        </Text>
      </View>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((iso, i) =>
            iso ? (
              <Day
                key={iso}
                iso={iso}
                size={cell}
                row={row}
                role={dayRole(iso, departDate, returnDate)}
                today={iso === today}
                past={iso < today}
                sets={mode === "return" && iso >= departDate ? "return" : "depart"}
                onPick={onPick}
              />
            ) : (
              <View key={`e${i}`} style={{ width: cell, height: row }} />
            ),
          )}
        </View>
      ))}
    </View>
  );
});

/**
 * Avreise og retur i ett ark: et trykk velger avreise, neste velger retur, og båndet mellom viser reisen. Skjemaet
 * oppdateres ved hvert trykk og er alltid gyldig (se lib/calendar.ts). Én vei: ett trykk. Dager før i dag kan ikke
 * velges. Toppen viser begge datoene og antall netter; trykk på en av dem bestemmer hva neste dag i kalenderen blir,
 * og ruller til den måneden. Arket åpner på måneden til datoen kunden trykket på (avreise eller retur).
 */
export function DateRangeSheet({
  visible,
  onClose,
  dates,
  roundTrip,
  startMode = "depart",
  onChange,
  footer,
  testID = "calendar",
}: {
  visible: boolean;
  onClose: () => void;
  dates: Dates;
  roundTrip: boolean;
  startMode?: PickMode;
  onChange: (next: Dates) => void;
  /** Handlingen nederst (f.eks. «Ferdig» eller «Søk på nytt»). */
  footer?: ReactNode;
  testID?: string;
}) {
  const lang = useA11yLanguage();
  const { t, f } = useI18n();
  const c = t.calendar;
  const { width, height, fontScale } = useWindowDimensions();
  const row = rowHeight(fontScale);
  const head = monthHeadHeight(fontScale);
  const openMode: PickMode = roundTrip ? startMode : "depart";
  const [mode, setMode] = useState<PickMode>(openMode);
  // Hver gang arket åpnes, starter det på valget kunden trykket på – allerede i den første tegningen, så listen åpner
  // på riktig måned (FlatList leser initialScrollIndex bare når den monteres).
  const [shownFor, setShownFor] = useState(visible);
  if (visible !== shownFor) {
    setShownFor(visible);
    if (visible && mode !== openMode) setMode(openMode);
  }
  const current: PickMode = mode;
  const today = todayIso();
  const months = useMemo(() => monthsFrom(today), [today]);
  const side = width < 360 ? NARROW_SIDE : SIDE;
  const cell = Math.floor((width - side * 2) / 7);
  const listHeight = Math.max(row * 5, Math.min(height * 0.5, 460));
  const list = useRef<FlatList<Month>>(null);
  const { departDate, returnDate } = dates;
  const onPick = useCallback(
    (iso: string) => {
      const next = applyPick({ departDate, returnDate }, iso, current, roundTrip);
      onChange({ departDate: next.departDate, returnDate: next.returnDate });
      setMode(next.next);
    },
    [departDate, returnDate, current, roundTrip, onChange],
  );
  const heights = useMemo(() => months.map((m) => head + monthGrid(m).length * row), [months, row, head]);
  const offsets = useMemo(() => heights.reduce<number[]>((acc, _h, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + heights[i - 1]!], []), [heights]);
  const start = monthIndexOf(months, current === "return" && roundTrip ? returnDate : departDate);
  const nights = roundTrip ? nightsBetween(departDate, returnDate) : null;
  const ret = roundTrip ? returnDate : null;
  const choose = (which: PickMode) => {
    setMode(which);
    const index = monthIndexOf(months, which === "return" ? returnDate : departDate);
    list.current?.scrollToIndex({ index, animated: true });
  };

  const pill = (which: PickMode, label: string, value: string) => {
    const on = current === which;
    return (
      <Pressable
        testID={`${testID}-pick-${which}`}
        onPress={() => choose(which)}
        accessibilityRole="button"
        accessibilityState={{ selected: on }}
        accessibilityLabel={`${label}: ${f.longDay(value)}`}
        style={({ pressed }) => [styles.pill, on && styles.pillOn, pressed && !on && { opacity: 0.7 }]}
      >
        <Text style={[type.caption, { color: on ? colors.blue : colors.textSecondary }]}>{label}</Text>
        <Text style={[type.calloutStrong, { color: colors.text }]}>{f.day(value)}</Text>
      </Pressable>
    );
  };

  return (
    <BottomSheet visible={visible} title={roundTrip ? c.title : c.titleOneWay} onClose={onClose} testID={testID} footer={footer}>
      <View accessibilityLanguage={lang} style={styles.summary} accessible={!roundTrip} accessibilityLabel={roundTrip ? undefined : c.summarySpoken(f.longDay(departDate), null, null)}>
        {roundTrip ? (
          <>
            {pill("depart", c.depart, departDate)}
            <View style={styles.nights}>
              <Text style={[type.caption, { color: colors.textSecondary, textAlign: "center" }]} testID={`${testID}-nights`}>
                {c.nights(nights ?? 0)}
              </Text>
            </View>
            {pill("return", c.return, returnDate)}
          </>
        ) : (
          <View style={[styles.pill, styles.pillOn]}>
            <Text style={[type.caption, { color: colors.blue }]}>{c.depart}</Text>
            <Text style={[type.calloutStrong, { color: colors.text }]}>{f.day(departDate)}</Text>
          </View>
        )}
      </View>
      <Text style={[type.footnote, { color: colors.textSecondary }]} accessibilityLiveRegion="polite" testID={`${testID}-hint`}>
        {current === "return" && roundTrip ? c.pickReturn : c.pickDepart}
      </Text>
      <View style={[styles.weekdays, { marginHorizontal: side - SIDE }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {c.weekdays.map((d, i) => (
          <Text key={i} style={[type.caption, styles.weekday, { width: cell }]} maxFontSizeMultiplier={1.3}>
            {d}
          </Text>
        ))}
      </View>
      <FlatList
        ref={list}
        testID={`${testID}-months`}
        // Høyden gir etter når arket ellers ikke får plass (stor tekst, liten skjerm), så handlingen nederst alltid synes.
        style={{ height: listHeight, flexShrink: 1, minHeight: head + row * 2, marginHorizontal: side - SIDE }}
        data={months}
        keyExtractor={(m) => `${m.year}-${m.month0}`}
        initialScrollIndex={start}
        getItemLayout={(_d, i) => ({ length: heights[i]!, offset: offsets[i]!, index: i })}
        onScrollToIndexFailed={() => undefined}
        initialNumToRender={3}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <MonthView month={item} cell={cell} row={row} head={head} departDate={departDate} returnDate={ret} today={today} mode={current} onPick={onPick} />}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summary: { flexDirection: "row", alignItems: "stretch", gap: space.sm },
  pill: { flex: 1, minHeight: TOUCH + 8, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white, paddingHorizontal: space.md, paddingVertical: space.xs + 2, justifyContent: "center" },
  pillOn: { borderColor: colors.blue, backgroundColor: colors.blueSoft },
  nights: { justifyContent: "center", paddingHorizontal: 2 },
  weekdays: { flexDirection: "row", marginTop: -space.xs },
  weekday: { textAlign: "center", color: colors.textSecondary, fontWeight: "600" },
  monthHead: { justifyContent: "flex-end", paddingBottom: space.xs },
  monthName: { color: colors.text, textTransform: "capitalize", paddingHorizontal: space.xs },
  week: { flexDirection: "row" },
  cell: { alignItems: "center", justifyContent: "center" },
  band: { position: "absolute", top: 3, bottom: 3, backgroundColor: colors.blueSoft },
  dot: { alignItems: "center", justifyContent: "center" },
  dotSelected: { backgroundColor: colors.blue },
  today: { borderWidth: 1.5, borderColor: colors.text },
  dayText: { fontSize: 16, lineHeight: 21, fontWeight: "500", color: colors.text },
  dayTextSelected: { color: colors.white, fontWeight: "700" },
  past: { color: colors.textDisabled },
});
