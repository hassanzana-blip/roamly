import { Link, NavLink } from "react-router";
import { useEffect, useState } from "react";
import { Plane, Radar, LifeBuoy, Luggage, Map, Menu, Sparkles, X, BedDouble, Globe } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import SkyMark from "@/components/brand/SkyMark";
import { SkipLink } from "@/components/app/AppShell";
import { LANGS, LANG_LABELS, useLang, useT, type I18nKey, type Lang } from "@/lib/i18n";

export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const t = useT();
  return (
    <Link to="/" className="group flex min-h-11 items-center gap-2 rounded-full" aria-label={t("nav.tofront")}>
      <SkyMark
        className={`h-8 w-8 transition-all duration-300 group-hover:-rotate-6 ${
          inverted ? "text-white" : "text-primary"
        }`}
      />
      {!compact && (
        <span
          className={`text-[22px] font-extrabold lowercase tracking-tight ${
            inverted ? "text-white" : "text-night"
          }`}
        >
          hellosky
        </span>
      )}
    </Link>
  );
}

const NAV: { to: string; label: I18nKey; icon: typeof Plane }[] = [
  { to: "/", label: "nav.search", icon: Plane },
  { to: "/reisemal", label: "nav.destinations", icon: Map },
  { to: "/quiz", label: "nav.quiz", icon: Sparkles },
  { to: "/hotell-bil", label: "nav.hotelcar", icon: BedDouble },
  { to: "/reise", label: "nav.mytrip", icon: Luggage },
  { to: "/flystatus", label: "nav.flightstatus", icon: Radar },
  { to: "/hjelp", label: "nav.support", icon: LifeBuoy },
];

/** Språkvelger — 5 språk, lagres lokalt og på kundekontoen (i18n.tsx). */
export function LanguageSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <label className={`relative inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-white px-2 text-[13px] font-semibold text-foreground ${className}`}>
      <Globe className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("nav.language")}</span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value as Lang)}
        aria-label={t("nav.language")}
        className="min-h-10 cursor-pointer bg-transparent pr-1 outline-none"
      >
        {LANGS.map((l) => (
          <option key={l} value={l}>
            {compact ? l.toUpperCase() : LANG_LABELS[l]}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b bg-white/95 backdrop-blur-md transition-all duration-300 ${
        scrolled ? "border-border py-1 shadow-[0_2px_12px_-6px_hsl(var(--night)/0.15)]" : "border-transparent py-2"
      }`}
    >
      <SkipLink />
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-5 md:flex lg:gap-6" aria-label={t("nav.mainmenu")}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `inline-flex min-h-11 items-center text-[13px] font-semibold transition-colors ${
                  isActive ? "text-primary" : "text-foreground/80 hover:text-night"
                }`
              }
            >
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" compact />
          <Link
            to="/reise"
            className="hidden min-h-11 items-center rounded-lg border border-primary/30 px-4 text-[13px] font-semibold text-primary transition-colors hover:bg-secondary lg:inline-flex"
          >
            {t("nav.findbooking")}
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-lg border border-border bg-white text-foreground transition-colors hover:bg-muted md:hidden"
                aria-label={t("nav.openmenu")}
              >
                <Menu className="h-5 w-5" aria-hidden="true" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-[min(20rem,90vw)] border-l border-border bg-card p-6 text-foreground"
            >
              <SheetTitle className="sr-only">{t("nav.mobilemenu")}</SheetTitle>
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="grid h-11 w-11 place-items-center rounded-lg border border-border"
                  aria-label={t("nav.closemenu")}
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <nav className="flex flex-col gap-1" aria-label={t("nav.mobilemenu")}>
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === "/"}
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      `flex min-h-12 items-center gap-3 rounded-xl px-4 text-base font-medium transition-colors ${
                        isActive ? "bg-secondary text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                    {t(item.label)}
                  </NavLink>
                ))}
              </nav>
              <div className="mt-6 border-t border-border pt-5">
                <LanguageSwitcher className="w-full" />
              </div>
              <p className="font-mono-label mt-8 text-[12px] leading-relaxed text-muted-foreground">
                {t("nav.hours")}
              </p>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
