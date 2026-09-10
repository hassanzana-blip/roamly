import { Link, NavLink, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { Plane, BookOpen, LifeBuoy, Luggage, Map, Menu, Sparkles, BedDouble } from "lucide-react";
import { Sheet, SheetBody, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import SkyMark from "@/components/brand/SkyMark";
import UserMenu from "@/components/account/UserMenu";
import { SkipLink } from "@/components/app/AppShell";
import { useT, type I18nKey } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { LocaleChip } from "./LocaleChip";

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

const NAV: { to: string; label: I18nKey; icon: typeof Plane }[] = [
  { to: "/", label: "nav.search", icon: Plane },
  { to: "/reisemal", label: "nav.destinations", icon: Map },
  { to: "/journal", label: "nav.journal", icon: BookOpen },
  { to: "/quiz", label: "nav.quiz", icon: Sparkles },
  { to: "/hotell-bil", label: "nav.hotelcar", icon: BedDouble },
  { to: "/reise", label: "nav.mytrip", icon: Luggage },
  { to: "/hjelp", label: "nav.support", icon: LifeBuoy },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const t = useT();
  const { pathname } = useLocation();
  // På forsiden flyter headeren over hero-bildet helt til man begynner å
  // scrolle – da faller den tilbake til den vanlige lyse flaten.
  const overHero = pathname === "/" && !scrolled;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md transition-[box-shadow,border-color,background-color] duration-base",
        overHero ? "border-transparent bg-transparent" : scrolled ? "border-border bg-background/90 shadow-xs" : "border-transparent bg-background/90",
      )}
    >
      <SkipLink />
      <div className="container-x flex h-16 items-center justify-between gap-3">
        <Logo inverted={overHero} />
        <nav className="hidden items-center gap-1 md:flex" aria-label={t("nav.mainmenu")}>
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "inline-flex min-h-10 items-center whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors xl:px-3 xl:text-sm",
                  overHero
                    ? isActive
                      ? "bg-white/15 text-white"
                      : "text-white/80 hover:bg-white/10 hover:text-white"
                    : isActive
                      ? "bg-primary-soft text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )
              }
            >
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <LocaleChip
            className={cn(
              "hidden sm:block",
              overHero && "[&_svg]:text-white/70 [&>button]:border-white/25 [&>button]:bg-white/10 [&>button]:text-white [&>button]:backdrop-blur-sm [&>button]:hover:border-white/60",
            )}
          />
          <Button asChild variant="outline" size="sm" className={cn("hidden lg:inline-flex", overHero && "border-white/25 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 hover:text-white")}>
            <Link to="/reise">{t("nav.findbooking")}</Link>
          </Button>
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
