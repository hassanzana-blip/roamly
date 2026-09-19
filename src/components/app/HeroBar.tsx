import { Link, useNavigate } from "react-router";
import { ArrowLeft, ChevronLeft, Heart, Share } from "lucide-react";
import Icon from "./Icon";
import Wordmark from "@/components/brand/Wordmark";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * The top row of a sub-screen: back on the left, the brand in the middle,
 * one action on the right (save or share). Plain 48 px targets; the
 * wordmark follows `tone` so it reads on photographs too.
 */
export default function HeroBar({
  backTo,
  tone = "dark",
  saved,
  onToggleSaved,
  saveLabel,
  onShare,
  shareLabel,
  backIcon = "arrow",
  className,
}: {
  /** Where «tilbake» goes; without it we step back in history. */
  backTo?: string;
  /** `light` = white wordmark over a photo, `dark` = petrol on white or mint. */
  tone?: "light" | "dark";
  saved?: boolean;
  onToggleSaved?: () => void;
  saveLabel?: string;
  onShare?: () => void;
  shareLabel?: string;
  backIcon?: "arrow" | "chevron";
  className?: string;
}) {
  const t = useT();
  const navigate = useNavigate();
  const round = cn(
    "grid size-12 place-items-center rounded-full transition-colors duration-fast focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    tone === "light" ? "bg-white/90 text-petrol hover:bg-white" : "text-petrol hover:bg-secondary",
  );
  const BackIcon = backIcon === "chevron" ? ChevronLeft : ArrowLeft;
  const back = backTo ? (
    <Link to={backTo} aria-label={t("topbar.back")} className={round}>
      <Icon icon={BackIcon} size={24} />
    </Link>
  ) : (
    <button type="button" onClick={() => navigate(-1)} aria-label={t("topbar.back")} className={round}>
      <Icon icon={BackIcon} size={24} />
    </button>
  );
  return (
    <div className={cn("flex items-center justify-between gap-3", className)}>
      {back}
      <Wordmark tone={tone} />
      {onToggleSaved ? (
        <button type="button" onClick={onToggleSaved} aria-pressed={saved} aria-label={saveLabel ?? t("nav.saved")} className={round}>
          <Icon icon={Heart} size={24} className={saved ? "fill-current" : undefined} />
        </button>
      ) : onShare ? (
        <button type="button" onClick={onShare} aria-label={shareLabel ?? t("oc.share.short")} className={round}>
          <Icon icon={Share} size={24} />
        </button>
      ) : (
        <span className="size-12" aria-hidden="true" />
      )}
    </div>
  );
}
