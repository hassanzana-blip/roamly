import { useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { trpc } from "@/providers/trpc";
import SkyMark from "@/components/brand/SkyMark";
import { Avatar } from "@/components/admin/Avatar";
import { cn } from "@/lib/utils";

/**
 * «Hvem av oss?»
 *
 * Zana og Zyar deler én eierkonto. Valget her er ikke en innlogging – den er
 * allerede gjort, med passord og MFA – og det gir ingen ekstra tilgang.
 * Det avgjør ett spørsmål: hvilket navn som står i revisjonsloggen når noen
 * endrer en leverandørinnstilling klokken to om natten.
 *
 * Derfor er skjermen rolig og rask. To kort, ett klikk, videre. Den dukker
 * opp én gang per økt; profilen byttes siden fra menyen uten å logge ut.
 */

type Profile = { id: string; name: string; title: string };

export function ProfileGate({ profiles, onChosen }: { profiles: Profile[]; onChosen: () => void }) {
  const [pending, setPending] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const setProfile = trpc.staffAuth.setProfile.useMutation({
    onSuccess: async () => {
      await utils.staffAuth.me.invalidate();
      onChosen();
    },
    onError: () => setPending(null),
  });

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-background px-5 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex items-center gap-2.5">
          <SkyMark className="h-8 w-8 text-primary" />
          <div>
            <p className="font-display text-xl font-semibold leading-none text-foreground">HelloSky</p>
            <p className="mt-1 eyebrow">Eierpanel</p>
          </div>
        </div>

        <h1 className="mt-10 font-display text-[34px] font-semibold leading-tight tracking-tight text-foreground sm:text-[40px]">Hvem er det som jobber?</h1>
        <p className="mt-2 max-w-lg text-[16px] leading-relaxed text-muted-foreground">
          Samme konto, to profiler. Valget endrer ingen tilganger – det avgjør hvilket navn som står i revisjonsloggen.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {profiles.map((p) => {
            const busy = pending === p.id;
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={setProfile.isPending}
                  onClick={() => {
                    setPending(p.id);
                    setProfile.mutate({ profile: p.id });
                  }}
                  className={cn(
                    "group flex w-full items-center gap-4 rounded-2xl border border-border bg-card p-5 text-left transition-[border-color,box-shadow] hover:border-primary/50 hover:shadow-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:opacity-60",
                    busy && "border-primary",
                  )}
                >
                  {/* Samme avatar som resten av adminen: eiernes egne bilder
                      når de finnes, ellers initialer. «Z» alene skilte ikke
                      Zana fra Zyar. */}
                  <Avatar name={p.name} size={64} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-[22px] font-semibold leading-tight text-foreground">{p.name}</span>
                    <span className="mt-0.5 block text-[14px] text-muted-foreground">{p.title}</span>
                    <span className="mt-3 inline-flex items-center gap-1.5 text-[14px] font-semibold text-primary">
                      {busy ? "Åpner …" : `Fortsett som ${p.name}`}
                      {!busy && <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        {setProfile.isError && (
          <p role="alert" className="mt-4 text-[14px] font-medium text-destructive">
            Profilen kunne ikke settes. Prøv igjen.
          </p>
        )}

        <p className="mt-8 flex items-start gap-2.5 text-[13px] leading-snug text-muted-foreground">
          <ShieldCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          Innloggingen er allerede bekreftet. Profilvalget gir ingen nye rettigheter, og alt du gjør logges på navnet du velger.
        </p>
      </div>
    </div>
  );
}
