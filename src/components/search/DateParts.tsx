import { useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Fødselsdato og passutløp: tre felt, ingen kalender.
 *
 * En kalender er riktig når man velger mellom datoer som ligger nær
 * hverandre – en avreise om tre uker. Den er feil når svaret er 1987: ingen
 * vil bla seg trettini år bakover, og nedtrekkene for måned og år er
 * innebygde `<select>`-er. På iOS åpner de systemets hjulvelger, og arket de
 * står i tolker det som et trykk utenfor seg selv og lukker seg. Da er feltet
 * ikke tungvint, det er umulig.
 *
 * Tre tallfelt er dessuten raskere for den som kan datoen sin utenat, som er
 * alle. Tastaturet er numerisk, og markøren hopper videre når feltet er fullt.
 */

type Props = {
  /** ISO `YYYY-MM-DD`, eller tom streng. */
  value: string;
  onChange: (iso: string) => void;
  label: string;
  invalid?: boolean;
  id?: string;
};

const pad = (n: string, len: number) => n.padStart(len, "0");

/** Deler opp ISO uten å kaste på halvferdige verdier. */
function parts(iso: string): { d: string; m: string; y: string } {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return { d: "", m: "", y: "" };
  return { y: match[1], m: match[2], d: match[3] };
}

export default function DateParts({ value, onChange, label, invalid, id }: Props) {
  const base = useId();
  const fieldId = id ?? base;

  /**
   * De tre feltene eier sin egen tekst.
   *
   * Verdien utad er én ISO-streng, og den finnes ikke før alle tre er fylt
   * ut. Leste feltene direkte fra den, ville det første sifferet du skrev
   * blitt vasket bort i samme øyeblikk – for da er datoen fortsatt ufullstendig
   * og ISO-strengen tom. Derfor står teksten her, og ISO går ut.
   */
  const [local, setLocal] = useState(() => parts(value));
  const [seen, setSeen] = useState(value);

  // Kommer det en ferdig dato utenfra – en lagret reisende hentes fram – tar
  // vi imot den. En tom verdi ignoreres: det er som regel vårt eget ekko
  // mens noen holder på å skrive.
  if (value !== seen) {
    setSeen(value);
    if (value !== "") setLocal(parts(value));
  }

  const cur = local;
  const dayRef = useRef<HTMLInputElement>(null);
  const monthRef = useRef<HTMLInputElement>(null);
  const yearRef = useRef<HTMLInputElement>(null);

  /**
   * Vi melder bare fra når alle tre er fylt ut og gir en dato som finnes.
   * 31. februar skal ikke bli 3. mars i det stille – da er feltet ugyldig, og
   * skjemaet sier fra med sin egen validering.
   */
  const emit = (d: string, m: string, y: string) => {
    if (d.length === 0 && m.length === 0 && y.length === 0) {
      onChange("");
      return;
    }
    if (y.length !== 4 || m.length === 0 || d.length === 0) {
      onChange("");
      return;
    }
    const iso = `${y}-${pad(m, 2)}-${pad(d, 2)}`;
    const probe = new Date(`${iso}T00:00:00Z`);
    const round = Number.isNaN(probe.getTime()) ? "" : probe.toISOString().slice(0, 10);
    onChange(round === iso ? iso : "");
  };

  const box = cn(
    "min-h-12 rounded-xl border bg-card px-3 text-center text-base tabular-nums text-foreground outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-ring/25",
    invalid ? "border-destructive" : "border-border",
  );

  const onlyDigits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);

  return (
    <fieldset>
      <legend className="sr-only">{label}</legend>
      <div className="flex items-start gap-2">
        <span className="flex-1">
          <label htmlFor={`${fieldId}-d`} className="mb-1 block text-[12px] font-medium text-muted-foreground">
            Dag
          </label>
          <input
            ref={dayRef}
            id={`${fieldId}-d`}
            value={cur.d}
            onChange={(e) => {
              const d = onlyDigits(e.target.value, 2);
              setLocal({ ...cur, d });
              emit(d, cur.m, cur.y);
              // Hopp videre når feltet ikke kan ta imot mer.
              if (d.length === 2) monthRef.current?.focus();
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="DD"
            aria-invalid={invalid || undefined}
            className={cn(box, "w-full")}
          />
        </span>
        <span className="flex-1">
          <label htmlFor={`${fieldId}-m`} className="mb-1 block text-[12px] font-medium text-muted-foreground">
            Måned
          </label>
          <input
            ref={monthRef}
            id={`${fieldId}-m`}
            value={cur.m}
            onChange={(e) => {
              const m = onlyDigits(e.target.value, 2);
              setLocal({ ...cur, m });
              emit(cur.d, m, cur.y);
              if (m.length === 2) yearRef.current?.focus();
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && cur.m.length === 0) dayRef.current?.focus();
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="MM"
            aria-invalid={invalid || undefined}
            className={cn(box, "w-full")}
          />
        </span>
        <span className="flex-[1.4]">
          <label htmlFor={`${fieldId}-y`} className="mb-1 block text-[12px] font-medium text-muted-foreground">
            År
          </label>
          <input
            ref={yearRef}
            id={`${fieldId}-y`}
            value={cur.y}
            onChange={(e) => {
              const y = onlyDigits(e.target.value, 4);
              setLocal({ ...cur, y });
              emit(cur.d, cur.m, y);
            }}
            onKeyDown={(e) => {
              if (e.key === "Backspace" && cur.y.length === 0) monthRef.current?.focus();
            }}
            inputMode="numeric"
            autoComplete="off"
            placeholder="ÅÅÅÅ"
            aria-invalid={invalid || undefined}
            className={cn(box, "w-full")}
          />
        </span>
      </div>
    </fieldset>
  );
}
