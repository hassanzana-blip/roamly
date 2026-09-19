interface Props {
  className?: string;
}

/**
 * HelloSky-merket: en «H» i azur – to søyler med skrå topper og en bue som
 * bærer broen mellom dem. Fyller med `currentColor`, så merket er azur på
 * lyse flater (standard), hvitt på mørke (`text-white`) og alltid samme form.
 */
export const SKY_MARK_PATH = "M8 16 L36 8 L36 34 L64 34 L64 22 L92 28 L92 92 L64 92 L64 60 A14 14 0 0 0 36 60 L36 92 L8 92 Z";

export default function SkyMark({ className = "h-8 w-8 text-azure" }: Props) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden="true" focusable="false">
      <path d={SKY_MARK_PATH} fill="currentColor" stroke="currentColor" strokeWidth="3" strokeLinejoin="round" />
    </svg>
  );
}
