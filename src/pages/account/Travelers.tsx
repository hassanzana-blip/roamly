import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Plus, Trash2, UserPlus } from "lucide-react";
import AppShell from "@/components/app/AppShell";
import { AppHeader } from "@/components/app/TopBar";
import Icon from "@/components/app/Icon";
import { EmptyState, PrimaryButton } from "@/components/app/primitives";
import { FamilyGlyph } from "@/components/graphics";
import DateField from "@/components/search/DateField";
import { useCustomer } from "@/lib/useCustomer";
import { trpc } from "@/providers/trpc";
import { humanMessage } from "@/lib/apiError";
import { PAGE_META, usePageMeta } from "@/lib/seo";

const inputCls =
  "w-full rounded-xl border border-border bg-card px-4 py-3 text-base outline-none transition-colors focus:border-foreground/30 placeholder:text-muted-foreground/60";

/** Lagrede reisende – fyll ut passasjerskjemaet med ett trykk i checkout. */
export default function Travelers() {
  usePageMeta(PAGE_META.travelers);
  const { customer, isLoading } = useCustomer();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const list = trpc.extras.myTravelers.useQuery(undefined, { enabled: Boolean(customer), retry: false });

  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bornOn, setBornOn] = useState("");
  const [gender, setGender] = useState<"m" | "f" | "">("");

  useEffect(() => {
    if (!isLoading && !customer) navigate("/logg-inn");
  }, [customer, isLoading, navigate]);

  const add = trpc.extras.addTraveler.useMutation({
    onSuccess: () => {
      setFirstName("");
      setLastName("");
      setBornOn("");
      setGender("");
      setOpen(false);
      utils.extras.myTravelers.invalidate();
    },
  });
  const del = trpc.extras.deleteTraveler.useMutation({
    onSuccess: () => utils.extras.myTravelers.invalidate(),
  });

  if (!customer) return null;

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <AppHeader title="Lagrede reisende" back />
        <p className="mb-5 text-[14px] text-muted-foreground">
          Familie og venner du reiser med ofte. Velg dem i checkout, så fylles skjemaet ut automatisk.
        </p>

        <div className="space-y-2.5">
          {list.data?.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-soft"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-muted text-[14px] font-semibold">
                {t.firstName.charAt(0).toUpperCase()}
                {t.lastName.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold">
                  {t.firstName} {t.lastName}
                </p>
                <p className="text-[12px] text-muted-foreground">
                  {t.bornOn
                    ? `Født ${new Date(`${t.bornOn}T12:00:00`).toLocaleDateString("nb-NO", { day: "numeric", month: "long", year: "numeric" })}`
                    : "Fødselsdato ikke lagret"}
                  {t.gender ? ` · ${t.gender === "m" ? "Mann" : "Kvinne"}` : ""}
                </p>
              </div>
              <button
                onClick={() => del.mutate({ id: t.id })}
                aria-label={`Slett ${t.firstName}`}
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
              >
                <Icon icon={Trash2} size={16} />
              </button>
            </div>
          ))}
          {list.data?.length === 0 && !open && (
            <EmptyState
              illustration={<FamilyGlyph size={56} className="text-foreground" />}
              title="Ingen lagrede reisende ennå"
              body="Legg til familien, så går neste bestilling mye raskere."
              action={<PrimaryButton icon={Plus} onClick={() => setOpen(true)} className="mt-2">Legg til reisende</PrimaryButton>}
            />
          )}
        </div>

        {open ? (
          <form
            className="mt-4 space-y-3 rounded-xl border border-border bg-card p-5 shadow-soft"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate({
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                ...(bornOn ? { bornOn } : {}),
                ...(gender ? { gender } : {}),
              });
            }}
          >
            <h2 className="flex items-center gap-2 font-display text-xl">
              <Icon icon={UserPlus} size={20} /> Ny reisende
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Fornavn (som i passet)" required className={inputCls} />
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Etternavn (som i passet)" required className={inputCls} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <DateField
                value={bornOn}
                onChange={setBornOn}
                placeholder="Fødselsdato (valgfritt)"
                captionLayout="dropdown"
                fromYear={1930}
                toYear={new Date().getFullYear()}
                max={new Date().toISOString().slice(0, 10)}
              />
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as typeof gender)}
                className={inputCls + " appearance-none"}
              >
                <option value="">Kjønn (valgfritt)</option>
                <option value="m">Mann</option>
                <option value="f">Kvinne</option>
              </select>
            </div>
            {add.isError && <p className="text-[12px] font-medium text-destructive">{humanMessage(add.error)}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={add.isPending || !firstName.trim() || !lastName.trim()}
                className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-full bg-night text-[14px] font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
              >
                <Icon icon={Plus} size={16} />
                {add.isPending ? "Lagrer …" : "Lagre reisende"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-lg border border-border px-5 text-[14px] font-semibold"
              >
                Avbryt
              </button>
            </div>
          </form>
        ) : (
          (list.data?.length ?? 0) > 0 && (
            <button
              onClick={() => setOpen(true)}
              className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-primary text-[14px] font-semibold text-primary-foreground transition-colors hover:opacity-90"
            >
              <Icon icon={Plus} size={16} /> Legg til reisende
            </button>
          )
        )}
      </AppShell>
    </div>
  );
}
