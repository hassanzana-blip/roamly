import type { SVGProps } from "react";

/**
 * Monokrome leverandørmerker (currentColor) til innloggingsknappene. Samme
 * størrelse og vekt som Lucide-ikonene rundt dem, så en knapperad ser ut som
 * én familie – ikke fire logoer i fire stiler.
 */
type MarkProps = Omit<SVGProps<SVGSVGElement>, "ref"> & { className?: string };

function Mark({ className, children, ...rest }: MarkProps) {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false" {...rest}>
      {children}
    </svg>
  );
}

export function AppleMark(p: MarkProps) {
  return (
    <Mark {...p}>
      <path d="M16.7 12.7c0-2.4 2-3.6 2.1-3.7-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.6-1-2.6-3.8ZM14.3 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.9-1 2.9 1.1.1 2.2-.5 2.8-1.3Z" />
    </Mark>
  );
}

export function GoogleMark(p: MarkProps) {
  return (
    <Mark {...p}>
      <path d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path d="M6.4 14a6 6 0 0 1 0-3.9V7.5H3.1a10 10 0 0 0 0 9L6.4 14Z" />
      <path d="M12 6c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.5L6.4 10c.8-2.3 3-4 5.6-4Z" />
    </Mark>
  );
}

export function FacebookMark(p: MarkProps) {
  return (
    <Mark {...p}>
      <path d="M13.5 21v-7.3h2.5l.4-2.9h-2.9V9c0-.8.2-1.4 1.4-1.4h1.5V5c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2.1H8v2.9h2.5V21h3Z" />
    </Mark>
  );
}

/** X (tidligere Twitter). Offisiell merkeform, tegnet som ren sti. */
export function XMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77Z" />
    </svg>
  );
}
