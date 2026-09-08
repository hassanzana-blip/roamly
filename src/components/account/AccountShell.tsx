import { NavLink } from "react-router";
import { LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { ACCOUNT_NAV } from "./accountNav";

/**
 * Rammen rundt Min side.
 *
 * På store skjermer står kartet permanent til venstre: kontoen er et sted du
 * blir værende og flytter deg rundt i, ikke en side du besøker og går tilbake
 * fra. På telefon finnes menyen allerede i bunnen, så sidemenyen forsvinner
 * helt i stedet for å bli en hamburger til.
 */
export function AccountShell({
  title,
  children,
  onSignOut,
}: {
  /** Vises over menyen på store skjermer. */
  title?: string;
  children: React.ReactNode;
  onSignOut?: () => void;
}) {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6 lg:px-8">
      <div className="lg:flex lg:gap-10">
        <aside className="hidden shrink-0 lg:block lg:w-[196px] lg:pt-8">
          <div className="sticky top-24">
            <p className="px-3 pb-3 font-display text-[22px] leading-none text-foreground">{title ?? "Min side"}</p>
            <nav aria-label="Min side">
              <ul className="space-y-0.5">
                {ACCOUNT_NAV.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end ?? false}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-primary",
                          isActive ? "bg-primary-soft text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        )
                      }
                    >
                      <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </nav>

            {onSignOut && (
              <>
                <hr className="my-3 border-border" />
                <button
                  type="button"
                  onClick={onSignOut}
                  className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <LogOut className="size-[18px] shrink-0" aria-hidden="true" />
                  Logg ut
                </button>
              </>
            )}
          </div>
        </aside>

        <div className="min-w-0 flex-1 pb-10 lg:pt-8">{children}</div>
      </div>
    </div>
  );
}
