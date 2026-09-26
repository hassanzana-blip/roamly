import { useMemo } from "react";
import type { StyleProp, TextStyle } from "react-native";
import { Text } from "./a11y";
import { markSegments } from "../lib/textMatch";

/**
 * Tekst der det kunden har skrevet er uthevet – som i iOS' egne søkelister. Uthevingen er bare visuell;
 * VoiceOver leser raden som før (knappen har sin egen etikett).
 */
export function MarkedText({ text, tokens, style, markStyle, testID }: { text: string; tokens: readonly string[]; style: StyleProp<TextStyle>; markStyle: StyleProp<TextStyle>; testID?: string }) {
  const parts = useMemo(() => markSegments(text, tokens), [text, tokens]);
  return (
    <Text style={style} testID={testID}>
      {parts.map((p, i) =>
        p.hit ? (
          <Text key={i} style={markStyle}>
            {p.text}
          </Text>
        ) : (
          p.text
        ),
      )}
    </Text>
  );
}
