import { Link } from "react-router";
import SkyMark from "./SkyMark";
import { useT } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Det azurblå H-merket + «hellosky», på hver side. `tone="light"` setter
 * ordmerket hvitt for fotografier; merket selv er alltid azur. Rendres som
 * lenke hjem med mindre `asLink` er false (f.eks. i en dialog).
 */
export default function Wordmark({ tone = "dark", size = "md", className, asLink = true }: { tone?: "light" | "dark"; size?: "sm" | "md" | "lg"; className?: string; asLink?: boolean }) {
  const t = useT();
  const text = size === "lg" ? "text-[30px]" : size === "sm" ? "text-[22px]" : "text-[26px]";
  const mark = size === "lg" ? "h-8 w-8" : size === "sm" ? "h-6 w-6" : "h-7 w-7";
  const inner = (
    <>
      <SkyMark className={cn(mark, "mr-1.5 shrink-0 text-azure")} />
      <span className={cn("wordmark", text, tone === "light" ? "text-white" : "text-petrol")}>hellosky</span>
    </>
  );
  if (!asLink) return <span className={cn("inline-flex items-center", className)}>{inner}</span>;
  return (
    <Link to="/" aria-label={t("nav.tofront")} className={cn("inline-flex min-h-11 items-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2", className)}>
      {inner}
    </Link>
  );
}
