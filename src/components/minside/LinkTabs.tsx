import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * Understrekede faner, som i den godkjente Min side-designen: tre ord på én
 * linje, aktiv fane i full farge med en tykk strek under, resten dempet.
 * Fanene er lenker når de går til egne sider, og knapper når de bytter
 * innhold på samme side.
 */
export type LinkTab<T extends string> = { id: T; label: string; to?: string };

export function LinkTabs<T extends string>({ tabs, active, onChange, className, label }: { tabs: LinkTab<T>[]; active: T; onChange?: (id: T) => void; className?: string; label: string }) {
  return (
    <nav aria-label={label} className={cn("border-b border-border", className)}>
      <ul className="-mb-px flex gap-2" role={onChange ? "tablist" : undefined}>
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          const cls = cn(
            "block min-h-12 whitespace-nowrap px-2 pb-3 pt-2 text-[16px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-ring min-[400px]:text-[17px] sm:px-3 sm:text-[18px]",
            isActive ? "border-b-[3px] border-foreground font-semibold text-foreground" : "border-b-[3px] border-transparent font-medium text-muted-foreground hover:text-foreground",
          );
          return (
            <li key={tab.id} className="flex-1 text-center sm:flex-none">
              {tab.to && !onChange ? (
                <Link to={tab.to} aria-current={isActive ? "page" : undefined} className={cls}>
                  {tab.label}
                </Link>
              ) : (
                <button type="button" role="tab" aria-selected={isActive} onClick={() => onChange?.(tab.id)} className={cn(cls, "w-full")}>
                  {tab.label}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
