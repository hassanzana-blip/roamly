import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { CURRENCIES, LANGS, LANG_LABELS, useLang, useLocale, useT, type Currency, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/**
 * Språk og valuta, i én knapp.
 *
 * To separate kontroller i toppen stjal plass fra navigasjonen og fortalte
 * ingenting hver for seg. Én brikke – «NB · NOK» – sier hvor du står, og
 * åpner begge valgene når du trykker.
 *
 * Valutaen er en visningspreferanse, ikke en omregner: prisen står alltid i
 * flyselskapets egen valuta. Det sier panelet rett ut, for en valutavelger som
 * ikke veksler er noe folk med rette forventer at gjør nettopp det.
 */
export function LocaleChip({ className }: { className?: string }) {
  const { lang, setLang } = useLang();
  const { currency, setCurrency } = useLocale();
  const t = useT();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2.5 text-sm font-medium text-foreground transition-colors hover:border-foreground/30"
      >
        <Globe className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="tabular-nums">
          {lang.toUpperCase()} <span className="text-muted-foreground">·</span> {currency}
        </span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} aria-hidden="true" />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={`${t("nav.language")} / ${t("profile.currency")}`}
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-[min(19rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
        >
          <Group label={t("nav.language")}>
            {LANGS.map((l) => (
              <Row key={l} selected={l === lang} onSelect={() => setLang(l as Lang)}>
                {LANG_LABELS[l]}
              </Row>
            ))}
          </Group>
          <Group label={t("profile.currency")}>
            {CURRENCIES.map((c) => (
              <Row key={c} selected={c === currency} onSelect={() => setCurrency(c as Currency)}>
                {c}
              </Row>
            ))}
          </Group>
          <p className="border-t border-border bg-muted/40 px-4 py-3 text-[12px] leading-snug text-muted-foreground">
            Prisen står alltid i flyselskapets egen valuta. Valget her styrer hvordan vi viser beløp ellers – vi veksler
            aldri om for deg.
          </p>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border p-1.5 last:border-b-0">
      <p className="px-2.5 pb-1 pt-1.5 eyebrow">{label}</p>
      {children}
    </div>
  );
}

function Row({ selected, onSelect, children }: { selected: boolean; onSelect: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-left text-sm transition-colors",
        selected ? "bg-muted font-semibold text-foreground" : "text-foreground hover:bg-muted/60",
      )}
    >
      {children}
      {selected && <Check className="size-4 shrink-0 text-foreground" aria-hidden="true" />}
    </button>
  );
}
