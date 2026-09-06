import { Link, NavLink, useLocation } from "react-router";
import { useEffect, useState } from "react";
import { Plane, Radar, LifeBuoy, Luggage, Map, Menu, X } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import RoamlyMark from "@/components/brand/RoamlyMark";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2 group" aria-label="Roamly – til forsiden">
      <RoamlyMark className="h-8 w-8 text-gold transition-transform duration-300 group-hover:-rotate-6" />
      {!compact && (
        <span className="text-[22px] font-extrabold lowercase tracking-tight text-foreground">
          roamly
        </span>
      )}
    </Link>
  );
}

const NAV = [
  { to: "/", label: "Søk fly", icon: Plane },
  { to: "/reisemal", label: "Reisemål", icon: Map },
  { to: "/reise", label: "Min reise", icon: Luggage },
  { to: "/flystatus", label: "Flystatus", icon: Radar },
  { to: "/hjelp", label: "Kundeservice", icon: LifeBuoy },
];

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-500 ${
        scrolled ? "glass border-b border-border py-2 shadow-sm" : "bg-transparent py-4"
      }`}
    >
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav className="hidden items-center gap-1 md:flex" aria-label="Hovedmeny">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-secondary text-gold"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/reise"
            className="hidden rounded-full border border-border bg-white/70 px-4 py-2 text-sm font-medium text-foreground backdrop-blur-md transition-colors hover:border-primary hover:text-primary sm:block"
          >
            Finn bestilling
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="grid h-10 w-10 place-items-center rounded-full border border-border bg-white/70 text-foreground backdrop-blur-md md:hidden"
                aria-label="Åpne meny"
              >
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="w-72 border-l border-border bg-card p-6 text-foreground"
            >
              <div className="mb-8 flex items-center justify-between">
                <Logo />
                <button
                  onClick={() => setOpen(false)}
                  className="grid h-9 w-9 place-items-center rounded-full border hairline"
                  aria-label="Lukk meny"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <nav className="flex flex-col gap-1" aria-label="Mobilmeny">
                {NAV.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-4 py-3.5 text-base font-medium transition-colors ${
                        isActive ? "bg-secondary text-gold" : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      }`
                    }
                  >
                    <item.icon className="h-5 w-5" />
                    {item.label}
                  </NavLink>
                ))}
              </nav>
              <p className="mt-10 text-xs leading-relaxed text-muted-foreground">
                Personlig kundeservice
                <br />
                alle dager 06–24
              </p>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
