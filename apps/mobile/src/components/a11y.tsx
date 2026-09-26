import { Pressable as RNPressable, Switch as RNSwitch, Text as RNText, type PressableProps, type SwitchProps, type TextProps } from "react-native";
import { useA11yLanguage } from "../i18n";

/**
 * VoiceOver skal lese med riktig stemme (nb-NO eller en-GB) uansett hvilket språk telefonen står på. iOS
 * leser `accessibilityLanguage` på elementet VoiceOver stopper på, og det arves ikke fra en forelder som
 * ikke selv er tilgjengelig – så språket settes på hver tekst, knapp og bryter. Et eksplisitt språk
 * (f.eks. «Norsk (bokmål)» i språkvelgeren) vinner.
 */
export function Text(props: TextProps) {
  const lang = useA11yLanguage();
  return <RNText {...props} accessibilityLanguage={props.accessibilityLanguage ?? lang} />;
}

export function Pressable(props: PressableProps) {
  const lang = useA11yLanguage();
  return <RNPressable {...props} accessibilityLanguage={props.accessibilityLanguage ?? lang} />;
}

export function Switch(props: SwitchProps) {
  const lang = useA11yLanguage();
  return <RNSwitch {...props} accessibilityLanguage={props.accessibilityLanguage ?? lang} />;
}
