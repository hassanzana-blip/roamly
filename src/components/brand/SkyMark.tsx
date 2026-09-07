interface Props {
  className?: string;
}

/**
 * HelloSky brand mark: two sweeping wings from the logo. The upper wing is
 * lime, the lower wing follows `currentColor` (near-black on light surfaces,
 * white on dark ones).
 */
export default function SkyMark({ className = "h-8 w-8" }: Props) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true" focusable="false">
      <path
        d="M8 26c5.5-1.5 11-2.6 15.4-5.2 4.1-2.4 6.6-6.1 10.5-9.4C37 9 40.6 8.2 45 8.2c-1.6 4.6-4.4 9.4-8.7 12.2-4.6 3-10.6 4.2-16.4 5-4 .6-8 .8-11.9.6Z"
        fill="hsl(var(--primary))"
      />
      <path
        d="M4 40c5.3-1.6 10.6-2.8 15-5.5 4.2-2.5 6.9-6.2 10.9-9.4 3.4-2.7 7.3-3.5 11.7-3.6-1.7 4.6-4.6 9.3-9 12.1-4.6 3-10.7 4.2-16.5 5-4 .6-8 1-12.1 1.4Z"
        fill="currentColor"
      />
    </svg>
  );
}
