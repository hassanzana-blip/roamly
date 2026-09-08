import { Link, NavLink } from "react-router";
import { useEffect, useState } from "react";
import { Plane, BookOpen, LifeBuoy, Luggage, Map, Menu, Sparkles, BedDouble, Globe } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import SkyMark from "@/components/brand/SkyMark";
import UserMenu from "@/components/account/UserMenu";
import { SkipLink } from "@/components/app/AppShell";
import { LANGS, LANG_LABELS, useLang, useT, type I18nKey, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const t = useT();
  return (
    <Link to="/" className="group flex min-h-11 items-center gap-2 rounded-md" aria-label={t("nav.tofront")}>
      <SkyMark className={cn("h-8 w-8 transition-transform duration-base group-hover:-rotate-6", inverted ? "text-white" : "text-foreground")} />
      {!compact && <span className={cn("text-[22px] font-extrabold lowercase tracking-tight", inverted ? "text-white" : "text-foreground")}>hellosky</span>}
    </Link>
  );
}

const NAV: { to: string; label: I18nKey; icon: typeof Plane }[] = [
  { to: "/", label: "nav.search", icon: Plane },
  { to: "/reisemal", label: "nav.destinations", icon: Map },
  { to: "/journal", label: "nav.journal", icon: BookOpen },
  { to: "/quiz", label: "nav.quiz", icon: Sparkles },
  { to: "/hotell-bil", label: "nav.hotelcar", icon: BedDouble },
  { to: "/reise", label: "nav.mytrip", icon: Luggage },
  { to: "/hjelp", label: "nav.support", icon: LifeBuoy },
];

/** Language switcher: 5 languages, stored locally and on the customer account (i18n.tsx). */
export function LanguageSwitcher({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const { lang, setLang } = useLang();
  const t = useT();
  return (
    <label className={cn("relative inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-border bg-card px-2 text-sm font-medium text-foreground", className)}>
      <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="sr-only">{t("nav.language")}</span>
      <select value={lang} onChange={(e) => setLang(e.target.value as Lang)} aria-label={t("nav.language")} className="min-h-9 cursor-pointer bg-transparent pr-1 outline-none">
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
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b bg-background/90 backdrop-blur-md transition-[box-shadow,border-color] duration-base",
        scrolled ? "border-border shadow-xs" : "border-transparent",
      )}
    >
      <SkipLink />
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.mainmenu")}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm",
                  isActive ? "bg-primary-soft text-accent-foreground" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )
              }
            >
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" compact />
          <Button asChild variant="outline" size="sm" className="hidden lg:inline-flex">
            <Link to="/reise">{t("nav.findbooking")}</Link>
          </Button>
          <UserMenu />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="md:hidden" aria-label={t("nav.openmenu")}>
                <Menu aria-hidden="true" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader className="pt-4">
                <SheetTitle className="sr-only">{t("nav.mobilemenu")}</SheetTitle>
                <Logo />
              </SheetHeader>
              <SheetBody className="pt-2">
                <nav className="flex flex-col gap-0.5" aria-label={t("nav.mobilemenu")}>
                  {NAV.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.to === "/"}
                      onClick={() => setOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-12 items-center gap-3 rounded-lg px-3 text-base font-medium transition-colors",
                          isActive ? "bg-primary-soft text-accent-foreground" : "text-foreground hover:bg-muted",
                        )
                      }
                    >
                      <item.icon className="size-5 text-muted-foreground" aria-hidden="true" />
                      {t(item.label)}
                    </NavLink>
                  ))}
                </nav>
                <div className="mt-6 border-t border-border pt-5">
                  <LanguageSwitcher className="w-full" />
                </div>
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">{t("nav.hours")}</p>
              </SheetBody>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
