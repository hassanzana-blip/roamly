import { Link } from "react-router";
import { Mail, Phone, ShieldCheck } from "lucide-react";
import RoamlyMark from "@/components/brand/RoamlyMark";
import { WhatsAppIcon, WHATSAPP_LINK, WHATSAPP_DISPLAY } from "@/components/WhatsAppFab";

export default function SiteFooter() {
  return (
    <footer className="relative bg-night text-white">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <RoamlyMark className="h-8 w-8 text-[#5B8CFF]" />
            <span className="text-[22px] font-extrabold lowercase tracking-tight text-white">roamly</span>
          </div>
          <p className="mt-3 text-sm font-medium text-[#9DB9F5]">Hele verden. Nærmere.</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-white/60">
            Vi gjør det like enkelt å fly som å drømme om det. Sammenlign
            hundrevis av flyselskaper, book på under to minutter og få hjelp av
            ekte mennesker når du trenger det.
          </p>
          <div className="mt-5 flex items-center gap-2 text-xs text-white/60">
            <ShieldCheck className="h-4 w-4 text-[#5B8CFF]" />
            Sikker betaling · Øyeblikkelig bekreftelse · Norsk kundeservice
          </div>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#9DB9F5]">
            Snarveier
          </h3>
          <ul className="space-y-2.5 text-sm">
            <li><Link className="text-white/60 transition-colors hover:text-white" to="/">Søk flybilletter</Link></li>
            <li><Link className="text-white/60 transition-colors hover:text-white" to="/reisemal">Reisemål over hele verden</Link></li>
            <li><Link className="text-white/60 transition-colors hover:text-white" to="/reise">Finn bestillingen din</Link></li>
            <li><Link className="text-white/60 transition-colors hover:text-white" to="/flystatus">Spor et fly</Link></li>
            <li><Link className="text-white/60 transition-colors hover:text-white" to="/hjelp">Kundeservice</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-[#9DB9F5]">
            Kontakt oss
          </h3>
          <ul className="space-y-3 text-sm text-white/60">
            <li className="flex items-center gap-2.5">
              <Mail className="h-4 w-4 text-[#5B8CFF]" /> hei@roamly.no
            </li>
            <li className="flex items-center gap-2.5">
              <Phone className="h-4 w-4 text-[#5B8CFF]" /> 22 41 00 00
            </li>
            <li>
              <a
                href={WHATSAPP_LINK}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 transition-colors hover:text-white"
              >
                <WhatsAppIcon className="h-4 w-4 text-[#5B8CFF]" /> WhatsApp {WHATSAPP_DISPLAY}
              </a>
            </li>
            <li className="text-xs leading-relaxed">
              Alle dager 06–24. Svar på e-post innen 2 timer i åpningstiden.
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-5 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Roamly AS · Oslo, Norge · Flyinnhold levert via Duffel
        <span className="mx-2 text-white/25">·</span>
        Foto: Unsplash- og Pexels-fotografer
      </div>
    </footer>
  );
}
