import { useState } from "react";
import { Platform, View } from "react-native";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { BottomSheet, Tile } from "./ui";
import { formatDay, fromIsoDate, toIsoDate } from "../lib/format";
import { colors } from "../lib/theme";

/**
 * Datofelt som grå flis. Et trykk åpner iOS' egen kalender (inline) i et ark
 * fra bunnen, på norsk. Verdien er en lokal dato (YYYY-MM-DD).
 */
export function DateField({ label, value, minimum, onChange, testID }: { label: string; value: string; minimum: string; onChange: (iso: string) => void; testID?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ flex: 1 }}>
      <Tile icon="calendar" label={label} value={formatDay(value)} onPress={() => setOpen(true)} accessibilityHint="Åpner kalenderen" testID={testID} />
      <BottomSheet visible={open} title={label} onClose={() => setOpen(false)} testID={testID ? `${testID}-sheet` : undefined}>
        <DateTimePicker
          testID={testID ? `${testID}-picker` : undefined}
          accessibilityLabel={`${label}, ${formatDay(value)}`}
          value={fromIsoDate(value)}
          minimumDate={fromIsoDate(minimum)}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          locale="nb-NO"
          accentColor={colors.indigo}
          themeVariant="light"
          onChange={(_e: DateTimePickerEvent, d?: Date) => {
            if (d) onChange(toIsoDate(d));
          }}
        />
      </BottomSheet>
    </View>
  );
}
