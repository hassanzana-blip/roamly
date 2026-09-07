import { useLocation } from "react-router";

export const WHATSAPP_NUMBER = "4797917976";
export const WHATSAPP_DISPLAY = "979 17 976";
export const WHATSAPP_LINK = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
  "Hei HelloSky! Jeg trenger hjelp med en reise.",
)}`;

export function WhatsAppIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true" focusable="false">
      <path d="M12.04 2a9.9 9.9 0 0 0-8.4 15.2L2 22l4.9-1.6A9.9 9.9 0 1 0 12.04 2Zm0 1.8a8.1 8.1 0 1 1-4.1 15.1l-.3-.2-2.9 1 1-2.9-.2-.3a8.1 8.1 0 0 1 6.5-12.7Zm-3 3.6c-.2 0-.5 0-.7.3-.2.3-.9.9-.9 2.1s.9 2.5 1 2.6c.2.2 1.8 2.8 4.3 3.9 2.1.9 2.6.7 3 .7.5 0 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.6-.3l-1.9-.9c-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.6 6.6 0 0 1-3.3-2.9c-.1-.2 0-.4.1-.5l.5-.6c.1-.2.2-.3.3-.5.1-.2 0-.4 0-.5L9.6 7.9c-.2-.4-.4-.5-.6-.5Z" />
    </svg>
  );
}

/** Stier der boblen skjules: betalingsfokus (checkout og tilbudslenke). */
const HIDDEN_PREFIXES = ["/bestill", "/tilbud"];

/**
 * Floating WhatsApp button – opens the WhatsApp app/chat directly.
 * Rendered once in the app layout; hidden on payment pages so it never
 * overlaps the fixed price bar or the Stripe element.
 */
export default function WhatsAppFab() {
  const { pathname } = useLocation();
  if (HIDDEN_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return null;
  // On the phone front page the bubble would sit on top of the search button;
  // the page already offers WhatsApp in its own section and in the footer.
  const desktopOnly = pathname === "/";
  return (
    <aside aria-label="WhatsApp">
    <a
      href={WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Chat med oss på WhatsApp – ${WHATSAPP_DISPLAY}`}
      className={`whatsapp-fab group fixed bottom-[calc(96px+env(safe-area-inset-bottom))] right-4 z-50 items-center gap-0 rounded-full bg-night p-3 text-white shadow-lift transition-transform duration-fast ease-out hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2 md:right-6 lg:bottom-6 ${desktopOnly ? "hidden lg:flex" : "flex"}`}
    >
      <WhatsAppIcon className="h-5 w-5" />
      <span className="sr-only">WhatsApp</span>
      <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-background bg-primary" aria-hidden="true" />
    </a>
    </aside>
  );
}
