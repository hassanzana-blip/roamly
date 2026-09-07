import { Glyph, LIME, type GlyphProps } from "./Glyph";
import { HsPassport, HsStatusTicketed } from "./pack";

export const PassportGlyph = HsPassport;
export const BoardingPassGlyph = HsStatusTicketed;

export function VisaStampGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <rect x="3.5" y="5.5" width="17" height="13" rx="2" transform="rotate(-6 12 12)" />
      <path d="M8 12.5h8M9 15.5h6" transform="rotate(-6 12 12)" />
      <path d="M8.5 9.5h2.5" transform="rotate(-6 12 12)" stroke={LIME} />
    </Glyph>
  );
}

export function LuggageTagGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M8 4.5h8l3 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8.5l3-4Z" />
      <path d="M10 4.5a2 2 0 1 1 4 0" />
      <path d="M8.5 12.5h7" />
      <path d="M8.5 16.5h5" stroke={LIME} />
    </Glyph>
  );
}
