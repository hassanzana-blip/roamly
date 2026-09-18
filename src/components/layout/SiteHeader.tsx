import { Link, NavLink, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { BedDouble, BookOpen, CarFront, Compass, LifeBuoy, Menu, Plane, Ticket } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import SkyMark from "@/components/brand/SkyMark";
import UserMenu from "@/components/account/UserMenu";
import { SkipLink } from "@/components/app/AppShell";
import { useT, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LocaleChip } from "./LocaleChip";

/**
 * HelloSky-logoen: rødt merke + ordmerke. `inverted` på røde/mørke flater.
 * Ordmerket beholdes uendret (lowercase «hellosky»); bare fargen er ny.
 */
export function Logo({ compact = false, inverted = false }: { compact?: boolean; inverted?: boolean }) {
  const t = useT();
  return (
    <Link to="/" className="group flex min-h-11 items-center gap-2 rounded-md" aria-label={t("nav.tofront")}>
      <SkyMark className={cn("h-8 w-8 transition-transform duration-base group-hover:-rotate-6", inverted ? "text-white" : "text-foreground")} />
      {!compact && (
        <span className="flex flex-col justify-center">
          <span className={cn("text-[22px] font-extrabold lowercase leading-none tracking-tight", inverted ? "text-white" : "text-foreground")}>hellosky</span>
          <span className={cn("mt-1 text-[8.5px] font-semibold uppercase leading-none tracking-[0.3em]", inverted ? "text-white/60" : "text-muted-foreground")}>{t("brand.tagline")}</span>
        </span>
      )}
    </Link>
  );
}

/** Produktene først, deretter oppdagelse og reiser. Hjelp og journal ligger i menyen og bunnteksten. */
const NAV: { to: string; label: I18nKey; icon: typeof Plane; end?: boolean; match?: RegExp }[] = [
  { to: "/", label: "nav.flights", icon: Plane, end: true, match: /^\/(sok)?$/ },
  { to: "/hotell", label: "nav.hotels", icon: BedDouble },
  { to: "/leiebil", label: "nav.cars", icon: CarFront },
  { to: "/utforsk", label: "nav.explore", icon: Compass, match: /^\/(utforsk|reisemal)/ },
  { to: "/reiser", label: "nav.trips", icon: Ticket, match: /^\/(reiser|reise)/ },
];

const MENU_EXTRA: { to: string; label: I18nKey; icon: typeof Plane; end?: boolean; match?: RegExp }[] = [
  { to: "/journal", label: "nav.journal", icon: BookOpen },
  { to: "/hjelp", label: "nav.support", icon: LifeBuoy },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();
  const { pathname } = useLocation();
  // På forsiden flyter headeren over den røde heroen helt til man begynner å
  // scrolle – da faller den tilbake til den vanlige lyse flaten.
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isActive = (item: (typeof NAV)[number]) => (item.match ? item.match.test(pathname) : pathname === item.to || pathname.startsWith(item.to + "/"));

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md transition-[box-shadow,border-color,background-color] duration-base",
        overHero ? "border-transparent bg-transparent" : scrolled ? "border-border bg-background/92 shadow-xs" : "border-transparent bg-background/92",
      )}
    >
      <SkipLink />
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Logo inverted={overHero} />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.mainmenu")}>
          {NAV.map((item) => {
            const active = isActive(item);
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors xl:px-3.5 xl:text-sm",
                  overHero
                    ? active
                      ? "bg-white/18 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                    : active
                      ? "bg-primary-soft text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
                )}
              >
                {t(item.label)}
              </NavLink>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleChip
            className={cn(
              "hidden sm:block",
              overHero && "[&_svg]:text-white/70 [&>button]:border-white/25 [&>button]:bg-white/10 [&>button]:text-white [&>button]:backdrop-blur-sm [&>button]:hover:border-white/60",
            )}
          />
          <UserMenu tone={overHero ? "dark" : "light"} />
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className={cn("md:hidden", overHero && "border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white")} aria-label={t("nav.openmenu")}>
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
                  {[...NAV, ...MENU_EXTRA].map((item) => {
                    const active = item.match ? item.match.test(pathname) : pathname === item.to || pathname.startsWith(item.to + "/");
                    return (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.end}
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex min-h-12 items-center gap-3 rounded-xl px-3 text-base font-medium transition-colors",
                          active ? "bg-primary-soft text-accent-foreground" : "text-foreground hover:bg-muted",
                        )}
                      >
                        <item.icon className={cn("size-5", active ? "text-accent-foreground" : "text-muted-foreground")} aria-hidden="true" />
                        {t(item.label)}
                      </NavLink>
                    );
                  })}
                </nav>
                <div className="mt-6 border-t border-border pt-5">
                  <LocaleChip className="w-full [&>button]:w-full [&>button]:justify-between" />
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
