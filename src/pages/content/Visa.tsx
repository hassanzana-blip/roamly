import ContentPage, { Section } from "./ContentPage";
import { COMPANY } from "./company";
import { VISA_NOTES, ALL_DESTINATIONS } from "@/content/discover";
import { faqJsonLd, PAGE_META, usePageMeta } from "@/lib/seo";

export default function Visa() {
  const noted = ALL_DESTINATIONS.filter((d) => VISA_NOTES[d.id]);
  usePageMeta({
    ...PAGE_META.visa,
    jsonLd: faqJsonLd(
      noted.slice(0, 12).map((d) => ({ question: `Trenger jeg visum til ${d.city} (${d.country}) med norsk pass?`, answer: VISA_NOTES[d.id] })),
    ),
  });

  return (
    <ContentPage
      eyebrow="Reiseinfo"
      title="Visumguiden"
      intro="Det er den reisendes eget ansvar å ha gyldige reisedokumenter. Her er generell veiledning for norske pass — endelige krav får du alltid fra ambassaden eller UDI."
    >
      <Section title="Det viktigste først">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Sjekk at passet er gyldig — mange land krever 6 måneders gyldighet etter planlagt hjemreise.</li>
          <li>Visumregler avhenger av hvilket pass du reiser med, ikke hvor du bor.</li>
          <li>Opppholdstillatelse i Norge gir ikke automatisk innreise til andre land.</li>
          <li>Husk transitt: noen land krever visum eller reisetillatelse selv om du bare skifter fly der (blant annet USA og Storbritannia).</li>
        </ul>
      </Section>

      <Section title="Regler for våre mest populære reisemål">
        <div className="not-prose mt-4 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-2.5 font-semibold text-foreground">Reisemål</th>
                <th className="px-4 py-2.5 font-semibold text-foreground">For norske pass</th>
              </tr>
            </thead>
            <tbody>
              {noted.map((d) => (
                <tr key={d.id} className="border-b border-border last:border-0">
                  <th className="whitespace-nowrap px-4 py-3 font-semibold text-foreground">
                    {d.city}
                    <span className="block text-[12px] font-normal text-muted-foreground">{d.country}</span>
                  </th>
                  <td className="px-4 py-3 text-muted-foreground">{VISA_NOTES[d.id]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[12px]">
          Listen over er veiledende og kan endres av myndighetene uten varsel. Kontroller alltid mot
          offisielle kilder før du bestiller.
        </p>
      </Section>

      <Section title="Offisielle kilder">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <a
              href="https://www.regjeringen.no/no/tema/utenrikssaker/reiseinformasjon/id2413163/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              UD sine reiseråd
            </a>{" "}
            — sikkerhet og innreise for nordmenn.
          </li>
          <li>
            <a
              href="https://www.udi.no"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-foreground underline underline-offset-2"
            >
              UDI
            </a>{" "}
            — visum til Norge og informasjon for ikke-norske statsborgere bosatt i Norge.
          </li>
          <li>Landets ambassade eller offisielle visumportal — endelig fasit for innreisekrav.</li>
        </ul>
      </Section>

      <Section title="Vi hjelper deg">
        <p>
          Usikker på hva som gjelder for reisen din? Kontakt oss på {COMPANY.supportEmail} eller{" "}
          {COMPANY.supportPhone} — vi hjelper deg med å finne riktig informasjon for ruten og passet ditt.
        </p>
      </Section>
    </ContentPage>
  );
}
