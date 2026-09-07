import type { ReactNode } from "react";
import DateField from "@/components/search/DateField";
import { COUNTRIES } from "@/content/countries";
import type { Gender, Title } from "@contracts/types";
import { emptyPax, inputCls, passengerLabel, selectCls, type PassengerContext, type PaxForm, type T } from "./passengerUtils";

/** Passasjerskjema — delt mellom Checkout (/bestill) og tilbudslenken (/tilbud). */

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
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);
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
        return (
          <fieldset key={p.id} className="rounded-xl border border-border bg-muted/40 p-4 sm:p-5">
            <legend className="px-1 text-base font-semibold text-foreground">{passengerLabel(p, passengers, t)}</legend>
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
                    <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={d.title ?? ""} onChange={(e) => onChange(p.id, { title: (e.target.value || undefined) as Title })} className={selectCls}>
                      <option value="">{t("common.choose")}</option>
                      <option value="mr">Mr</option>
                      <option value="ms">Ms</option>
                      <option value="mrs">Mrs</option>
                    </select>
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
                    <DateField value={d.bornOn} onChange={(iso) => onChange(p.id, { bornOn: iso })} placeholder={t("co.f.born")} captionLayout="dropdown" fromYear={1920} toYear={year} max={today} error={a.invalid} />
                  </div>
                )}
              </Field>
              {p.type !== "infant_without_seat" && (
                <Field id={`${idp}-gender`} label={t("co.f.gender")} error={errors[k("gender")]} hint={t("co.f.gender.hint")}>
                  {(a) => (
                    <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={d.gender ?? ""} onChange={(e) => onChange(p.id, { gender: (e.target.value || undefined) as Gender })} className={selectCls}>
                      <option value="">{t("common.choose")}</option>
                      <option value="m">{t("co.f.male")}</option>
                      <option value="f">{t("co.f.female")}</option>
                    </select>
                  )}
                </Field>
              )}
              {p.type === "infant_without_seat" && (
                <Field id={`${idp}-guardian`} label={t("co.f.guardian")} error={errors[k("infantPassengerId")]}>
                  {(a) => (
                    <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={d.infantPassengerId ?? ""} onChange={(e) => onChange(p.id, { infantPassengerId: e.target.value || undefined })} className={selectCls}>
                      <option value="">{t("common.choose")}</option>
                      {adults.map((ad, ai) => (
                        <option key={ad.id} value={ad.id}>
                          {pax[ad.id]?.givenName || t("co.f.adultn", { n: ai + 1 })}
                        </option>
                      ))}
                    </select>
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
                      <select id={a.id} aria-describedby={a.describedBy} aria-invalid={a.invalid} value={d.passportCountry} onChange={(e) => onChange(p.id, { passportCountry: e.target.value })} className={selectCls}>
                        {COUNTRIES.map((c) => (
                          <option key={c.code} value={c.code}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </Field>
                  <Field id={`${idp}-expiry`} label={t("co.f.expiry")} error={errors[k("identityDocument.expiresOn")]} hint={t("co.f.expiry.hint", { date: lastArrival })}>
                    {(a) => (
                      <div aria-describedby={a.describedBy}>
                        <DateField value={d.passportExpiry} onChange={(iso) => onChange(p.id, { passportExpiry: iso })} placeholder={t("co.f.expiry")} captionLayout="dropdown" fromYear={year} toYear={year + 15} min={lastArrival} error={a.invalid} />
                      </div>
                    )}
                  </Field>
                </>
              )}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
