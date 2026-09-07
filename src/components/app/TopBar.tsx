import { Link, useNavigate } from "react-router";
import { ChevronLeft, Search, SlidersHorizontal, User } from "lucide-react";
import Icon from "./Icon";
import { IconButton } from "./primitives";
import SkyMark from "@/components/brand/SkyMark";
import { useCustomer } from "@/lib/useCustomer";
import { useT } from "@/lib/i18n";

/**
 * TopBar — the greeting header of the home screen.
 * Circular avatar, personal greeting when logged in, quiet icon actions.
 * All targets ≥ 44px.
 */
export function GreetingBar({ onSearch }: { onSearch?: () => void }) {
  const { customer } = useCustomer();
  const t = useT();
  return (
    <header
      className="flex items-center justify-between gap-4 pb-5"
      style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}
    >
      <Link to="/profil" className="flex min-h-11 min-w-0 items-center gap-3 rounded-full" aria-label={t("topbar.openprofile")}>
        {customer?.avatarUrl ? (
          <span className="h-12 w-12 shrink-0 overflow-hidden rounded-full">
            <img src={customer.avatarUrl} alt="" className="h-full w-full object-cover" />
          </span>
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon icon={User} size={20} />
          </span>
        )}
        <span className="min-w-0">
          <span className="block text-[13px] text-muted-foreground">
            {customer ? t("greet.name", { name: customer.firstName }) : t("greet.hi")}
          </span>
          <span className="block truncate text-[15px] font-semibold leading-tight">
            {t("greet.where")}
          </span>
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        <IconButton icon={Search} label={t("topbar.search")} onClick={onSearch} />
        <Link
          to="/profil"
          aria-label={t("topbar.settings")}
          title={t("topbar.settings")}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white text-foreground transition-colors duration-200 hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Icon icon={SlidersHorizontal} size={20} />
        </Link>
      </div>
    </header>
  );
}

/**
 * AppHeader — compact bar for sub-screens: back chevron + title,
 * or the brand mark on first-level app tabs.
 *
 * A11y (OTA-186): only ONE h1 per page. The title renders as a <p> by default;
 * pass `as="h1"` from pages that have no other h1.
 */
export function AppHeader({
  title,
  back = false,
  as: Tag = "p",
}: {
  title?: string;
  back?: boolean;
  as?: "h1" | "h2" | "p" | "div";
}) {
  const navigate = useNavigate();
  const t = useT();
  return (
    <header
      className="flex items-center gap-3 pb-5"
      style={{ paddingTop: "max(20px, env(safe-area-inset-top))" }}
    >
      {back ? (
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label={t("topbar.back")}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-white transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Icon icon={ChevronLeft} size={20} />
        </button>
      ) : (
        <Link to="/" aria-label={t("topbar.home")} className="flex min-h-11 min-w-11 items-center gap-2 rounded-full">
          <SkyMark className="h-7 w-7 text-[hsl(var(--skyline))]" />
        </Link>
      )}
      {title ? <Tag className="font-display text-xl tracking-tight">{title}</Tag> : null}
    </header>
  );
}
