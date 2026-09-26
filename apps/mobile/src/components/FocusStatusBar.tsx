import { StatusBar, type StatusBarStyle } from "expo-status-bar";
import { useIsFocused } from "expo-router";

/**
 * Statuslinjen for én fane. Fanene står montert side om side, og React Native slår sammen alle StatusBar-er i den
 * rekkefølgen de ble montert: den sist monterte vinner i hele appen. Da sto Hjem med hvit klokke på lys grunn etter et
 * besøk på Min side (lys tekst over grafitten). Her er bare fanen som vises, montert – når kunden bytter fane, fjernes
 * den forrige og den nye legges øverst.
 */
export function FocusStatusBar({ style, animated }: { style: StatusBarStyle; animated?: boolean }) {
  const focused = useIsFocused();
  return focused ? <StatusBar style={style} animated={animated} /> : null;
}
