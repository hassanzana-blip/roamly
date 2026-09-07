interface Props {
  className?: string;
}

/**
 * HelloSky brand mark — a swift in ascending flight over a sweeping
 * route arc, drawn from the visual identity (brand blue on navy).
 */
export default function SkyMark({ className = "h-8 w-8" }: Props) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* main route arc */}
      <path
        d="M8.5 39.5C14.5 21.5 26.5 11.5 42.5 9.5"
        stroke="currentColor"
        strokeWidth="5.5"
        strokeLinecap="round"
      />
      {/* inner arc */}
      <path
        d="M21.5 41.5C26.5 33.5 33.5 28.5 42.5 26.5"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        opacity="0.75"
      />
      {/* swift */}
      <path d="M30.5 12.5L43.5 6.5L37 18Z" fill="currentColor" />
    </svg>
  );
}
