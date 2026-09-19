import { Link } from "react-router";
import Icon from "./Icon";
import { SERVICES, type ServiceId } from "./services";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

/**
 * The four services: Fly · Hotell · Leiebil · Cruise.
 *
 * Two shapes, one meaning. `tile` is the phone home screen (four square
 * tiles, icon over label); `pill` is everywhere else (icon beside label).
 * The active service is burgundy with white text, the rest sit on card
 * white. Give it `onSelect` to switch in place (home) or `hrefFor` to
 * navigate (results pages).
 */
export type { ServiceId } from "./services";

type Props = {
  active: ServiceId;
  variant?: "tile" | "pill";
  onSelect?: (id: ServiceId) => void;
  hrefFor?: (id: ServiceId) => string;
  className?: string;
};

export default function ServiceTabs({ active, variant = "pill", onSelect, hrefFor, className }: Props) {
  const t = useT();
  const tile = variant === "tile";
  const itemCls = (on: boolean) =>
    cn(
      "outline-none transition-[background-color,color,transform] duration-fast focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.98] motion-reduce:active:scale-100",
      tile
        ? "flex h-[112px] w-full flex-col items-center justify-center gap-3 rounded-[22px] text-[17px] font-medium sm:h-[124px]"
        : "inline-flex h-14 shrink-0 items-center gap-2.5 rounded-[20px] px-5 text-[17px] font-medium sm:px-6",
      on ? "bg-burgundy text-white shadow-soft" : "bg-card text-foreground hover:bg-white",
    );

  return (
    <div
      role={onSelect ? "tablist" : undefined}
      aria-label={t("home.services")}
      className={cn(tile ? "grid grid-cols-4 gap-2.5 sm:gap-3" : "no-scrollbar flex gap-2.5 overflow-x-auto sm:gap-3", className)}
    >
      {SERVICES.map((s) => {
        const on = s.id === active;
        const inner = (
          <>
            <Icon icon={s.icon} size={tile ? 28 : 24} />
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
