import { useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { BottomSheet } from "./ui";
import { Icon, type IconName } from "./Icon";
import { formatDay, fromIsoDate, toIsoDate } from "../lib/format";
import { colors, radius, space, type } from "../lib/theme";

/** Én celle i søkeskjemaets rutenett: ikon, etikett og verdi. */
export function FormTile({
  icon,
  label,
  value,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  testID,
  action,
}: {
  icon: IconName;
  label: string;
  value: string;
  onPress: () => void;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  testID?: string;
  /** Verdien er en handling («Legg til»), ikke et valgt svar. */
  action?: boolean;
}) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? `${label}: ${value}`}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [styles.tile, pressed && { backgroundColor: colors.inset }]}
    >
      <Icon name={icon} size={20} color={colors.text} strokeWidth={1.75} />
      <View style={{ flex: 1 }}>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
        <Text style={[type.calloutStrong, { color: action ? colors.blue : colors.text }]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

/**
 * Datofelt: en celle som åpner iOS' egen kalender (inline) i et ark fra
 * bunnen, på norsk. Verdien er en lokal dato (YYYY-MM-DD); datoer før
 * `minimum` kan ikke velges.
 */
export function DateField({ label, value, minimum, onChange, testID, open, onOpenChange }: { label: string; value: string; minimum: string; onChange: (iso: string) => void; testID?: string; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  const [ownOpen, setOwnOpen] = useState(false);
  const visible = open ?? ownOpen;
  const setVisible = onOpenChange ?? setOwnOpen;
  return (
    <>
      <FormTile icon="calendar" label={label} value={formatDay(value)} onPress={() => setVisible(true)} accessibilityHint="Åpner kalenderen" testID={testID} />
      <BottomSheet visible={visible} title={label} onClose={() => setVisible(false)} testID={testID ? `${testID}-sheet` : undefined}>
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          accessibilityLabel={`${label}, ${formatDay(value)}`}
          value={fromIsoDate(value)}
          minimumDate={fromIsoDate(minimum)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          locale="nb-NO"
          accentColor={colors.blue}
          themeVariant="light"
          onChange={(_e: DateTimePickerEvent, d?: Date) => {
            if (d) onChange(toIsoDate(d));
          }}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  tile: { flex: 1, flexDirection: "row", alignItems: "center", gap: space.md, minHeight: 60, paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.input, borderWidth: 1, borderColor: colors.lightBorder, backgroundColor: colors.white },
});
