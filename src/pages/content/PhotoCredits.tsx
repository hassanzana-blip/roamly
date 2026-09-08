import { Link } from "react-router";
import AppShell from "@/components/app/AppShell";
import SiteFooter from "@/components/layout/SiteFooter";
import { ALL_CREDITS, licenceLabel, pendingAttributionCount, photoSrc } from "@/content/photos";
import { destinationById } from "@/content/discover";
import { usePageMeta } from "@/lib/seo";

/**
 * Bildene bak reisen.
 *
 * En reiseside lever av fotografier, og de er tatt av noen. Denne siden sier
 * hvem, hvor og under hvilken lisens – og den er en bildeside, ikke en
 * tabell: kredittene står under bildene de gjelder.
 *
 * Der fotografens navn ennå ikke er nedtegnet hos oss, sier siden det én
 * gang øverst i stedet for å gjenta «ukjent» tjuefem ganger. Vi finner ikke
 * på et navn for å fylle en kolonne.
 */

export default function PhotoCredits() {
  usePageMeta({
    title: "Bildene bak reisen | HelloSky",
    description:
      "HelloSky bruker ekte fotografi fra fotografer over hele verden. Her er bildene, stedene de viser og lisensene de er brukt under.",
    canonicalPath: "/fotokreditering",
  });

  const pending = pendingAttributionCount();

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppShell>
        <header className="pb-10 pt-8 sm:pt-12">
          <p className="font-mono-label text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Fotokreditering</p>
          <h1 className="t-display mt-3 max-w-3xl">Bildene bak reisen.</h1>
          <p className="t-lead mt-5 max-w-2xl text-muted-foreground">
            Hvert sted du ser på HelloSky er fotografert av et menneske som faktisk var der. Vi bruker ikke
            AI-genererte reisebilder, ingen oppdiktede landemerker og ingen genererte mennesker – et bilde av
            Istanbul skal være Istanbul.
          </p>
          {pending > 0 && (
            <p className="t-body mt-4 max-w-2xl text-muted-foreground">
              Bildene er hentet fra Unsplash- og Pexels-samlingene under deres lisenser. Vi holder på å føre
              fotografens navn tilbake til hvert enkelt bilde; {pending} av dem står ennå uten navngitt
              fotograf her. Er det ditt bilde, vil vi gjerne kreditere deg –{" "}
              <a href="mailto:hei@hellosky.no" className="font-semibold text-foreground underline underline-offset-4">
                si fra
              </a>
              .
            </p>
          )}
        </header>

        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 border-t border-border pt-10 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_CREDITS.map((c) => {
            const dest = c.destinationId ? destinationById(c.destinationId) : undefined;
            return (
              <li key={c.key}>
                <figure>
                  <span className="block overflow-hidden rounded-xl bg-muted">
                    <img
                      src={photoSrc(c.key)}
                      alt={c.caption}
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={400}
                      className="aspect-[4/3] h-auto w-full object-cover"
                    />
                  </span>
                  <figcaption className="mt-2.5">
                    {dest ? (
                      <Link to={`/reisemal#${dest.id}`} className="block text-[15px] font-semibold underline-offset-4 hover:underline">
                        {dest.city}
                      </Link>
                    ) : (
                      <span className="block text-[15px] font-semibold">{c.caption}</span>
                    )}
                    <span className="t-caption mt-0.5 block">
                      {c.photographer ? (
                        c.photographerUrl ? (
                          <a href={c.photographerUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                            {c.photographer}
                          </a>
                        ) : (
                          c.photographer
                        )
                      ) : null}
                      {c.photographer ? " · " : ""}
                      {licenceLabel(c.source)}
                    </span>
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>

        <section className="mt-16 border-t border-border pt-10">
          <h2 className="t-h2">Slik velger vi bilder</h2>
          <div className="t-body mt-4 max-w-2xl space-y-4 text-muted-foreground">
            <p>
              Et bilde må vise stedet det påstår å vise. Vi bruker ikke bilder av et annet sted fordi det er
              penere, og vi genererer ikke landemerker, hoteller eller mennesker.
            </p>
            <p>
              Bilder av mennesker skal vise noe som kunne skjedd: en familie ved en gate, ikke en modell som
              poserer med koffert. Der vi ikke har et ekte, kontrollert bilde, bruker vi HelloSkys egne
              tegninger i stedet for å fylle plassen med noe oppdiktet.
            </p>
          </div>
        </section>
      </AppShell>
      <div className="mt-20"><SiteFooter /></div>
    </div>
  );
}
