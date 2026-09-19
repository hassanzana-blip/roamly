import { Link } from "react-router";
import Icon from "./Icon";
import { SERVICES, type ServiceId } from "./services";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * The four services: Fly · Hotell · Leiebil · Cruise.
 *
 * `underline` (default, the search card): four equal columns, icon beside
 * label, the active one carries a petrol underline. `pill` (results pages):
 * icon beside label in a bordered chip, the active one filled petrol.
 * Give it `onSelect` to switch in place (home) or `hrefFor` to navigate.
 */
export type { ServiceId } from "./services";

type Props = {
  active: ServiceId;
  variant?: "underline" | "pill";
  onSelect?: (id: ServiceId) => void;
  hrefFor?: (id: ServiceId) => string;
  className?: string;
};

export default function ServiceTabs({ active, variant = "underline", onSelect, hrefFor, className }: Props) {
  const t = useT();
  const underline = variant === "underline";
  const itemCls = (on: boolean) =>
    cn(
      "outline-none transition-[background-color,color,border-color] duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      underline
        ? cn(
            "relative flex h-14 w-full items-center justify-center gap-2 text-[15px] font-medium sm:text-[16px]",
            "after:absolute after:inset-x-1 after:bottom-0 after:h-[3px] after:rounded-full after:transition-colors after:duration-fast",
            on ? "text-petrol after:bg-petrol" : "text-petrol/80 hover:text-petrol after:bg-transparent",
          )
        : cn(
            "inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border px-4 text-[15px] font-medium",
            on ? "border-petrol bg-petrol text-white" : "border-border bg-white text-petrol hover:border-petrol/40",
          ),
    );

  return (
    <div
      role={onSelect ? "tablist" : undefined}
      aria-label={t("home.services")}
      className={cn(underline ? "grid grid-cols-4 border-b border-border" : "no-scrollbar flex gap-2 overflow-x-auto", className)}
    >
      {SERVICES.map((s) => {
        const on = s.id === active;
        const inner = (
          <>
            <Icon icon={s.icon} size={24} className={underline ? "shrink-0" : "shrink-0 [&]:size-5"} />
            <span>{t(s.label)}</span>
          </>
        );
        if (onSelect) {
          return (
            <button key={s.id} type="button" role="tab" aria-selected={on} onClick={() => onSelect(s.id)} className={itemCls(on)}>
              {inner}
            </button>
          );
        }
        return (
          <Link key={s.id} to={hrefFor ? hrefFor(s.id) : s.to} aria-current={on ? "page" : undefined} className={itemCls(on)}>
            {inner}
          </Link>
        );
      })}
    </div>
  );
}
