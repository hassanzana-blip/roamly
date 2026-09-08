import { Link, useNavigate } from "react-router";
import { ChevronLeft } from "lucide-react";
import Icon from "./Icon";
import SkyMark from "@/components/brand/SkyMark";
import UserMenu from "@/components/account/UserMenu";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * GreetingBar: the phone header of the home screen. Brand on the left,
 * one control on the right (the profile), nothing else. The search lives
 * one thumb-flick below and does not need an icon pointing at it.
 * All targets ≥ 44px.
 */
export function GreetingBar({ tone = "light" }: { tone?: "light" | "dark" }) {
  const t = useT();
  const onDark = tone === "dark";
  return (
    <header
      className={cn("flex items-center justify-between gap-4 pb-6", onDark && "text-white")}
      style={{ paddingTop: "max(18px, env(safe-area-inset-top))" }}
    >
      <Link to="/" aria-label={t("topbar.home")} className="flex min-h-11 items-center gap-2 rounded-full">
        <SkyMark className={cn("h-7 w-7", onDark ? "text-white" : "text-foreground")} />
        <span className="text-[19px] font-extrabold lowercase tracking-tight">hellosky</span>
      </Link>
      <UserMenu tone={tone} />
    </header>
  );
}

/**
 * AppHeader – compact bar for sub-screens: back chevron + title,
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
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-card transition-colors duration-fast hover:border-foreground/40 hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-ring"
        >
          <Icon icon={ChevronLeft} size={20} />
        </button>
      ) : (
        <Link to="/" aria-label={t("topbar.home")} className="flex min-h-11 min-w-11 items-center gap-2 rounded-full lg:hidden">
          <SkyMark className="h-7 w-7 text-foreground" />
        </Link>
      )}
      {title ? <Tag className="t-h1">{title}</Tag> : null}
    </header>
  );
}
