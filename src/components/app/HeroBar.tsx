import { Link, useNavigate } from "react-router";
import { ArrowLeft, Heart } from "lucide-react";
import Icon from "./Icon";
import SkyMark from "@/components/brand/SkyMark";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The bar that floats over a photo hero: back on the left, the brand in the
 * middle, the heart on the right. Round white targets keep it readable over
 * any photograph; the mark and wordmark follow `tone`.
 */
export default function HeroBar({
  backTo,
  tone = "light",
  saved,
  onToggleSaved,
  saveLabel,
  className,
}: {
  /** Where «tilbake» goes; without it we step back in history. */
  backTo?: string;
  /** `light` = white wordmark over a photo, `dark` = ink on ivory. */
  tone?: "light" | "dark";
  saved?: boolean;
  onToggleSaved?: () => void;
  saveLabel?: string;
  className?: string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const round = "grid size-14 place-items-center rounded-full bg-white text-foreground shadow-soft transition-transform duration-fast active:scale-95 motion-reduce:active:scale-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";
  const back = backTo ? (
    <Link to={backTo} aria-label={t("topbar.back")} className={round}>
      <Icon icon={ArrowLeft} size={24} />
    </Link>
  ) : (
    <button type="button" onClick={() => navigate(-1)} aria-label={t("topbar.back")} className={round}>
      <Icon icon={ArrowLeft} size={24} />
    </button>
  );
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {back}
      <Link to="/" aria-label={t("nav.tofront")} className={cn("flex items-center gap-1 rounded-full", tone === "light" ? "text-white" : "text-foreground")}>
        <span className="text-[26px] font-medium lowercase leading-none tracking-tight">hellosky</span>
        <SkyMark className="h-7 w-7" />
      </Link>
      {onToggleSaved ? (
        <button type="button" onClick={onToggleSaved} aria-pressed={saved} aria-label={saveLabel ?? t("nav.saved")} className={cn(round, saved && "text-primary")}>
          <Icon icon={Heart} size={24} className={saved ? "fill-current" : undefined} />
        </button>
      ) : (
        <span className="size-14" aria-hidden="true" />
      )}
    </div>
  );
}
