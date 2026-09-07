import { Glyph, type GlyphProps } from "./Glyph";

export function PassportGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <circle cx="12" cy="10" r="3" />
      <path d="M9 17h6" />
    </Glyph>
  );
}

export function VisaStampGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <rect x="3" y="5" width="18" height="14" rx="2" transform="rotate(-6 12 12)" />
      <path d="M8 12h8M9 15h6" transform="rotate(-6 12 12)" />
      <path d="M8.5 9h2" transform="rotate(-6 12 12)" />
    </Glyph>
  );
}

export function BoardingPassGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a1.5 1.5 0 0 0 0 3V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4.5a1.5 1.5 0 0 0 0-3V7Z" />
      <path d="M15 5v14" strokeDasharray="2 2" />
      <path d="M6 10h6M6 14h4" />
    </Glyph>
  );
}

export function LuggageTagGlyph(p: GlyphProps) {
  return (
    <Glyph {...p}>
      <path d="M8 4h8l3 4v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8l3-4Z" />
      <path d="M10 4a2 2 0 1 1 4 0" />
      <path d="M8.5 12h7M8.5 16h5" />
    </Glyph>
  );
}
