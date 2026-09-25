import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { FlatList, StyleSheet, View, useWindowDimensions } from "react-native";
import { Pressable, Text } from "./a11y";
import { BottomSheet } from "./ui";
import { applyPick, dayRole, monthGrid, monthIndexOf, monthsFrom, nightsBetween, todayIso, type DayRole, type Month, type PickMode } from "../lib/calendar";
import { useA11yLanguage, useI18n } from "../i18n";
import { colors, radius, space, TOUCH, type } from "../lib/theme";

const MONTH_HEAD = 40;
const SIDE = space.xl;
/** Dagtallene vokser med tekststørrelsen opp til det dobbelte; større ville ikke fått plass i sju kolonner. */
const DAY_SCALE_MAX = 2;

/** Radhøyden: minst 44 pt, og høyere når dagtallet blir stort. */
function rowHeight(fontScale: number): number {
  return Math.max(TOUCH + 2, Math.ceil(21 * Math.min(fontScale, DAY_SCALE_MAX) + 12));
}

type Dates = { departDate: string; returnDate: string };

/** Én dag: tallet, og for valget en blå sirkel (avreise/retur) og et lyseblått bånd mellom dem. */
const Day = memo(function Day({ iso, size, row, role, today, past, mode, onPick }: { iso: string; size: number; row: number; role: DayRole; today: boolean; past: boolean; mode: PickMode; onPick: (iso: string) => void }) {
  const { t, f } = useI18n();
  const c = t.calendar;
  const selected = role === "depart" || role === "return" || role === "same";
  const day = Number(iso.slice(8, 10));
  const spoken = [f.longDay(iso), role ? c.roles[role] : null, today ? c.today : null, past ? c.past : null].filter(Boolean).join(", ");
  return (
    <Pressable
      testID={`day-${iso}`}
      onPress={() => onPick(iso)}
      disabled={past}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      accessibilityHint={past ? undefined : mode === "return" ? c.hintReturn : c.hintDepart}
      accessibilityState={{ selected, disabled: past }}
      style={[styles.cell, { width: size, height: row }]}
    >
      {/* Båndet mellom avreise og retur: hele cellen innimellom, halve ved endene. */}
      {role === "inside" ? <View style={[styles.band, { left: 0, right: 0 }]} /> : null}
      {role === "depart" ? <View style={[styles.band, { left: size / 2, right: 0 }]} testID={`band-${iso}`} /> : null}
      {role === "return" ? <View style={[styles.band, { left: 0, right: size / 2 }]} /> : null}
      <View style={[styles.dot, { width: Math.min(size, row) - 4, height: Math.min(size, row) - 4, borderRadius: (Math.min(size, row) - 4) / 2 }, selected && styles.dotSelected, today && !selected && styles.today]}>
        <Text style={[styles.dayText, type.tabular, past && styles.past, selected && styles.dayTextSelected, role === "inside" && { color: colors.blue }]} maxFontSizeMultiplier={DAY_SCALE_MAX}>
          {day}
        </Text>
      </View>
    </Pressable>
  );
});

/** En måned: navnet og ukene. Tomme plasser før den første og etter den siste dagen. */
const MonthView = memo(function MonthView({ month, cell, row, departDate, returnDate, today, mode, onPick }: { month: Month; cell: number; row: number; departDate: string; returnDate: string | null; today: string; mode: PickMode; onPick: (iso: string) => void }) {
  const { f } = useI18n();
  const weeks = useMemo(() => monthGrid(month), [month]);
  return (
    <View testID={`month-${month.year}-${month.month0 + 1}`}>
      <Text style={[type.bodyStrong, styles.monthHead]} accessibilityRole="header">
        {f.monthYear(month.year, month.month0)}
      </Text>
      {weeks.map((week, w) => (
        <View key={w} style={styles.week}>
          {week.map((iso, i) =>
            iso ? (
              <Day key={iso} iso={iso} size={cell} row={row} role={dayRole(iso, departDate, returnDate)} today={iso === today} past={iso < today} mode={mode} onPick={onPick} />
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
 * velges. Toppen viser begge datoene og antall netter; trykk på en av dem bestemmer hva neste dag i kalenderen blir.
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
  const [mode, setMode] = useState<PickMode>(startMode);
  const today = todayIso();
  const months = useMemo(() => monthsFrom(today), [today]);
  const cell = Math.floor((width - SIDE * 2) / 7);
  const listHeight = Math.max(row * 5, Math.min(height * 0.5, 460));
  // Hver gang arket åpnes: start på valget kunden trykket på (avreise eller retur).
  const wasVisible = useRef(false);
  useEffect(() => {
    if (visible && !wasVisible.current) setMode(roundTrip ? startMode : "depart");
    wasVisible.current = visible;
  }, [visible, startMode, roundTrip]);
  const { departDate, returnDate } = dates;
  const onPick = useCallback(
    (iso: string) => {
      const next = applyPick({ departDate, returnDate }, iso, mode, roundTrip);
      onChange({ departDate: next.departDate, returnDate: next.returnDate });
      setMode(next.next);
    },
    [departDate, returnDate, mode, roundTrip, onChange],
  );
  const heights = useMemo(() => months.map((m) => MONTH_HEAD + monthGrid(m).length * row), [months, row]);
  const offsets = useMemo(() => heights.reduce<number[]>((acc, h, i) => [...acc, i === 0 ? 0 : acc[i - 1]! + heights[i - 1]!], []), [heights]);
  const start = monthIndexOf(months, mode === "return" && roundTrip ? dates.returnDate : dates.departDate);
  const nights = roundTrip ? nightsBetween(dates.departDate, dates.returnDate) : null;
  const ret = roundTrip ? dates.returnDate : null;

  const pill = (which: PickMode, label: string, value: string) => {
    const on = mode === which;
    return (
      <Pressable
        testID={`${testID}-pick-${which}`}
        onPress={() => setMode(which)}
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
      <View accessibilityLanguage={lang} style={styles.summary} accessible={!roundTrip} accessibilityLabel={roundTrip ? undefined : c.summarySpoken(f.longDay(dates.departDate), null, null)}>
        {roundTrip ? (
          <>
            {pill("depart", c.depart, dates.departDate)}
            <View style={styles.nights}>
              <Text style={[type.caption, { color: colors.textSecondary, textAlign: "center" }]} testID={`${testID}-nights`}>
                {c.nights(nights ?? 0)}
              </Text>
            </View>
            {pill("return", c.return, dates.returnDate)}
          </>
        ) : (
          <View style={[styles.pill, styles.pillOn]}>
            <Text style={[type.caption, { color: colors.blue }]}>{c.depart}</Text>
            <Text style={[type.calloutStrong, { color: colors.text }]}>{f.day(dates.departDate)}</Text>
          </View>
        )}
      </View>
      <Text style={[type.footnote, { color: colors.textSecondary }]} accessibilityLiveRegion="polite" testID={`${testID}-hint`}>
        {mode === "return" && roundTrip ? c.pickReturn : c.pickDepart}
      </Text>
      <View style={styles.weekdays} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {c.weekdays.map((d, i) => (
          <Text key={i} style={[type.caption, styles.weekday, { width: cell }]} maxFontSizeMultiplier={1.3}>
            {d}
          </Text>
        ))}
      </View>
      <FlatList
        testID={`${testID}-months`}
        style={{ height: listHeight, marginHorizontal: -2 }}
        data={months}
        keyExtractor={(m) => `${m.year}-${m.month0}`}
        initialScrollIndex={start}
        getItemLayout={(_d, i) => ({ length: heights[i]!, offset: offsets[i]!, index: i })}
        initialNumToRender={3}
        windowSize={5}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => <MonthView month={item} cell={cell} row={row} departDate={dates.departDate} returnDate={ret} today={today} mode={mode} onPick={onPick} />}
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
  monthHead: { color: colors.text, height: MONTH_HEAD, textAlignVertical: "center", paddingTop: space.md, textTransform: "capitalize" },
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
