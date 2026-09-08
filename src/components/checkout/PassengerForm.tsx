import { useMemo, useState, type ReactNode } from "react";
import * as Collapsible from "@radix-ui/react-collapsible";
import { Check, ChevronDown } from "lucide-react";
import DateParts from "@/components/search/DateParts";
import SelectWrap from "./SelectWrap";
import { Chip } from "@/components/ui/chip";
import { COUNTRIES } from "@/content/countries";
import type { Gender, Title } from "@contracts/types";
import { emptyPax, inputCls, passengerComplete, passengerLabel, passengerSummary, selectCls, type PassengerContext, type PaxForm, type T } from "./passengerUtils";
import { cn } from "@/lib/utils";

/** A short fixed choice is one tap, not open-a-menu-then-tap. Radio semantics for screen readers. */
function ChoiceRow<V extends string>({ id, label, value, options, onChange, describedBy, invalid }: { id: string; label: string; value: V | undefined; options: { value: V; label: string }[]; onChange: (v: V) => void; describedBy?: string; invalid: boolean }) {
  return (
    <div id={id} role="radiogroup" aria-label={label} aria-describedby={describedBy} aria-invalid={invalid || undefined} className="flex gap-2">
      {options.map((o) => (
        <Chip key={o.value} role="radio" aria-checked={value === o.value} selected={value === o.value} onClick={() => onChange(o.value)} className="min-h-11 min-w-0 flex-1 justify-center px-2">
          {o.label}
        </Chip>
      ))}
    </div>
  );
}

/** Passasjerskjema – delt mellom Checkout (/bestill) og tilbudslenken (/tilbud). */

// ─── Små feltkomponenter ────────────────────────────────────────────────────


export function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: (a: { id: string; describedBy?: string; invalid: boolean }) => ReactNode;
}) {
  const errId = `${id}-err`;
  const hintId = `${id}-hint`;
  const describedBy = [error ? errId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-foreground">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {hint && (
        <span id={hintId} className="mt-1 block text-xs text-muted-foreground">
          {hint}
        </span>
      )}
      {error && (
        <span id={errId} role="alert" className="mt-1 block text-xs font-medium text-destructive">
          {error}
        </span>
      )}
    </div>
  );
}

// ─── Skjema ─────────────────────────────────────────────────────────────────

export type SavedTraveler = { id: number | string; firstName: string; lastName: string; bornOn?: string | null; gender?: string | null };

export type PassengerFormProps = PassengerContext & {
  pax: Record<string, PaxForm>;
  onChange: (id: string, patch: Partial<PaxForm>) => void;
  errors: Record<string, string>;
  savedTravelers?: SavedTraveler[];
  t: T;
  /** Prefiks for element-id-er når flere skjemaer finnes på samme side. */
  idPrefix?: string;
};

export default function PassengerForm({ passengers, lastArrival, identityDocumentsRequired, pax, onChange, errors, savedTravelers = [], t, idPrefix = "pax" }: PassengerFormProps) {
  const adults = passengers.filter((p) => p.type === "adult");

  /**
   * Én reisende av gangen.
   *
   * Tre reisende med pass ga trettifem felt på rad på en telefon. Nå står den
   * du holder på med åpen, resten hviler som sammendragslinjer, og neste
   * åpner seg av seg selv når den forrige er ferdig. Alt er fortsatt på
   * samme side – ingenting er gjemt bak et nytt steg.
   */
  const complete = useMemo(
    () => passengers.map((p) => passengerComplete(p, pax[p.id], identityDocumentsRequired)),
    [passengers, pax, identityDocumentsRequired],
  );
  const [chosen, setChosen] = useState<number | null>(null);
  const firstErrorIndex = passengers.findIndex((_, i) => Object.keys(errors).some((key) => key.startsWith(`passengers.${i}.`)));
  const firstIncomplete = complete.findIndex((c) => !c);

  // Åpen rad utledes, den lagres ikke: en feil vinner alltid, deretter et
  // bevisst valg så lenge den raden ikke er ferdig, ellers den første som
  // mangler noe. Da flytter den seg av seg selv uten en eneste effekt.
  const open =
    firstErrorIndex !== -1
      ? firstErrorIndex
      : chosen !== null && !complete[chosen]
        ? chosen
        : firstIncomplete === -1
          ? null
          : firstIncomplete;
  const setOpen = (i: number | null) => setChosen(i);
  return (
    <div className="space-y-6">
      {errors.passengers && (
        <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {errors.passengers}
        </p>
      )}
      {passengers.map((p, i) => {
        const d = pax[p.id] ?? emptyPax();
        const k = (f: string) => `passengers.${i}.${f}`;
        const idp = `${idPrefix}-${i}`;
        const done = complete[i];
        const summary = passengerSummary(pax[p.id]);
        const hasError = Object.keys(errors).some((key) => key.startsWith(`passengers.${i}.`));
        return (
          <Collapsible.Root
            key={p.id}
            open={open === i}
            onOpenChange={(o) => setOpen(o ? i : null)}
            className={cn("overflow-hidden rounded-xl border transition-colors", open === i ? "border-foreground/30" : hasError ? "border-destructive/40" : "border-border")}
          >
            {/* Sammendragslinjen er reisendens hvilestilling: navn når det er
                fylt ut, en hake når alt er på plass, og en tydelig vei inn. */}
            <Collapsible.Trigger asChild>
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-muted/50">
                <span className={cn("grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold", done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>
                  {done ? <Check className="size-4" aria-hidden="true" /> : i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold leading-tight">{passengerLabel(p, passengers, t)}</span>
                  <span className={cn("mt-0.5 block truncate text-[13px]", hasError ? "text-destructive" : "text-muted-foreground")}>
                    {hasError ? t("co.pax.hasError") : summary || t("co.pax.empty")}
                  </span>
                </span>
                <ChevronDown className={cn("size-5 shrink-0 text-muted-foreground transition-transform duration-base ease-out", open === i && "rotate-180")} aria-hidden="true" />
              </button>
            </Collapsible.Trigger>
            <Collapsible.Content className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up">
              <div className="border-t border-border px-4 pb-5 pt-4">
            {savedTravelers.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="eyebrow">{t("co.pax.fromsaved")}</span>
                {savedTravelers.map((tv) => (
                  <button
                    key={tv.id}
                    type="button"
                    onClick={() =>
                      onChange(p.id, {
                        givenName: tv.firstName,
                        familyName: tv.lastName,
                        bornOn: tv.bornOn ?? "",
                        gender: (tv.gender as Gender | null) ?? undefined,
                        title: tv.gender === "f" ? "ms" : tv.gender === "m" ? "mr" : undefined,
                      })
                    }
                    className="min-h-10 rounded-lg border border-border bg-card px-3 text-sm font-medium text-foreground transition-colors hover:border-foreground/40"
                  >
                    {tv.firstName} {tv.lastName}
                  </button>
                ))}
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {p.type !== "infant_without_seat" && (
                <Field id={`${idp}-title`} label={t("co.f.title")} error={errors[k("title")]}>
                  {(a) => (
                    <ChoiceRow<Title>
                      id={a.id}
                      label={t("co.f.title")}
                      describedBy={a.describedBy}
                      invalid={a.invalid}
                      value={d.title}
                      options={[
                        { value: "mr", label: "Mr" },
                        { value: "ms", label: "Ms" },
                        { value: "mrs", label: "Mrs" },
                      ]}
                      onChange={(v) => onChange(p.id, { title: v })}
                    />
                  )}
                </Field>
              )}
              <Field id={`${idp}-given`} label={t("co.f.given")} error={errors[k("givenName")]}>
                {(a) => (
                  <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} autoComplete={i === 0 ? "given-name" : "off"} placeholder="Ola" value={d.givenName} onChange={(e) => onChange(p.id, { givenName: e.target.value })} className={inputCls} />
                )}
              </Field>
              <Field id={`${idp}-family`} label={t("co.f.family")} error={errors[k("familyName")]}>
                {(a) => (
                  <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} autoComplete={i === 0 ? "family-name" : "off"} placeholder="Nordmann" value={d.familyName} onChange={(e) => onChange(p.id, { familyName: e.target.value })} className={inputCls} />
                )}
              </Field>
              <Field
                id={`${idp}-born`}
                label={t("co.f.born")}
                error={errors[k("bornOn")]}
                hint={p.type === "adult" ? t("co.f.born.adult") : p.type === "child" ? t("co.f.born.child") : t("co.f.born.infant")}
              >
                {(a) => (
                  <div aria-describedby={a.describedBy}>
                    <DateParts value={d.bornOn} onChange={(iso) => onChange(p.id, { bornOn: iso })} label={t("co.f.born")} invalid={a.invalid} />
                  </div>
                )}
              </Field>
              {p.type !== "infant_without_seat" && (
                <Field id={`${idp}-gender`} label={t("co.f.gender")} error={errors[k("gender")]} hint={t("co.f.gender.hint")}>
                  {(a) => (
                    <ChoiceRow<Gender>
                      id={a.id}
                      label={t("co.f.gender")}
                      describedBy={a.describedBy}
                      invalid={a.invalid}
                      value={d.gender}
                      options={[
                        { value: "m", label: t("co.f.male") },
                        { value: "f", label: t("co.f.female") },
                      ]}
                      onChange={(v) => onChange(p.id, { gender: v })}
                    />
                  )}
                </Field>
              )}
              {p.type === "infant_without_seat" && (
                <Field id={`${idp}-guardian`} label={t("co.f.guardian")} error={errors[k("infantPassengerId")]}>
                  {(a) => (
                    <SelectWrap>
                      <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={d.infantPassengerId ?? ""} onChange={(e) => onChange(p.id, { infantPassengerId: e.target.value || undefined })} className={selectCls}>
                        <option value="">{t("common.choose")}</option>
                        {adults.map((ad, ai) => (
                          <option key={ad.id} value={ad.id}>
                            {pax[ad.id]?.givenName || t("co.f.adultn", { n: ai + 1 })}
                          </option>
                        ))}
                      </select>
                    </SelectWrap>
                  )}
                </Field>
              )}
              {identityDocumentsRequired && (
                <>
                  <Field id={`${idp}-pass`} label={t("co.f.passport")} error={errors[k("identityDocument.uniqueIdentifier")]} hint={t("co.f.passport.hint")}>
                    {(a) => (
                      <input id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} autoComplete="off" inputMode="text" placeholder="12345678" value={d.passportNumber} onChange={(e) => onChange(p.id, { passportNumber: e.target.value })} className={inputCls + " uppercase"} />
                    )}
                  </Field>
                  <Field id={`${idp}-country`} label={t("co.f.country")} error={errors[k("identityDocument.issuingCountryCode")]}>
                    {(a) => (
                      <SelectWrap>
                        <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={d.passportCountry} onChange={(e) => onChange(p.id, { passportCountry: e.target.value })} className={selectCls}>
                          {COUNTRIES.map((c) => (
                            <option key={c.code} value={c.code}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </SelectWrap>
                    )}
                  </Field>
                  <Field id={`${idp}-expiry`} label={t("co.f.expiry")} error={errors[k("identityDocument.expiresOn")]} hint={t("co.f.expiry.hint", { date: lastArrival })}>
                    {(a) => (
                      <div aria-describedby={a.describedBy}>
                        <DateParts value={d.passportExpiry} onChange={(iso) => onChange(p.id, { passportExpiry: iso })} label={t("co.f.expiry")} invalid={a.invalid} />
                      </div>
                    )}
                  </Field>
                </>
              )}
            </div>
              </div>
            </Collapsible.Content>
          </Collapsible.Root>
        );
      })}
    </div>
  );
}
