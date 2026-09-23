import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { StyleSheet, Text, View } from "react-native";
import { formatDay, fromIsoDate, toIsoDate } from "../lib/format";
import { colors, fonts } from "../lib/theme";

/** Datovalg med iOS' egen kompakte velger, på norsk. Verdien er en lokal dato (YYYY-MM-DD). */
export function DateField({ label, value, minimum, onChange, testID }: { label: string; value: string; minimum: string; onChange: (iso: string) => void; testID?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.value}>{formatDay(value)}</Text>
      </View>
      <DateTimePicker
        testID={testID}
        accessibilityLabel={`${label}, ${formatDay(value)}`}
        value={fromIsoDate(value)}
        minimumDate={fromIsoDate(minimum)}
        mode="date"
        display="compact"
        locale="nb-NO"
        onChange={(_e: DateTimePickerEvent, d?: Date) => {
          if (d) onChange(toIsoDate(d));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", minHeight: 52 },
  label: { fontFamily: fonts.semibold, fontSize: 12, letterSpacing: 0.5, textTransform: "uppercase", color: colors.textMuted },
  value: { fontFamily: fonts.bold, fontSize: 16, color: colors.text },
});
