import { Link } from "react-router";
import ContentPage, { LegalNote, Section } from "./ContentPage";
import { COMPANY } from "./company";
import { articleJsonLd, PAGE_META, usePageMeta } from "@/lib/seo";

const UPDATED = "2026-09-07";

export default function Privacy() {
  usePageMeta({
    ...PAGE_META.privacy,
    type: "article",
    jsonLd: articleJsonLd({ headline: "Personvernerklæring", description: PAGE_META.privacy.description, path: "/personvern", dateModified: UPDATED }),
  });

  return (
    <ContentPage
      eyebrow="Personvern"
      title="Personvernerklæring"
      intro="Vi samler bare inn det vi trenger for å levere reisen din – og vi selger aldri dataene dine. Her forklarer vi hva vi lagrer, hvorfor, hvem som hjelper oss med det, og hvilke rettigheter du har."
      updated={UPDATED}
    >
      <Section title="1. Behandlingsansvarlig" id="behandlingsansvarlig">
        <p>
          {COMPANY.identityLine}, er behandlingsansvarlig for
          personopplysninger som samles inn gjennom hellosky.no og tilhørende tjenester. Spørsmål om personvern
          sendes til{" "}
          <a href={`mailto:${COMPANY.privacyEmail}`} className="font-semibold text-foreground underline underline-offset-2">
            {COMPANY.privacyEmail}
          </a>
          . <LegalNote>angi personvernkontakt/DPO dersom påkrevd</LegalNote>
        </p>
      </Section>

      <Section title="2. Hvilke opplysninger vi behandler" id="opplysninger">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Kontaktopplysninger: navn, e-postadresse og telefonnummer.</li>
          <li>
            Reiseopplysninger: passasjernavn, fødselsdato, kjønn og reisedetaljer. På enkelte ruter krever
            flyselskapet også passnummer, utstederland og utløpsdato – disse lagres kryptert og vises kun maskert.
          </li>
          <li>Betalingsstatus og referanser fra Stripe. Vi lagrer aldri kortnummer eller sikkerhetskode.</li>
          <li>Kontoinformasjon dersom du oppretter konto: innlogging, lagrede reisende, prisvarsler og preferanser (språk, valuta).</li>
          <li>Henvendelser til kundeservice, slik at vi kan følge opp saken din.</li>
          <li>Tekniske logger (IP-adresse, tidspunkt, nettlesertype) for sikkerhet og feilsøking.</li>
        </ul>
      </Section>

      <Section title="3. Formål og rettslig grunnlag" id="formal">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Gjennomføre bestillingen din og utstede billett hos flyselskapet – <em>avtale</em> (GDPR art. 6 nr. 1 b).</li>
          <li>Sende bekreftelser, reiseinformasjon og viktige varsler om reisen – <em>avtale</em>.</li>
          <li>Kundeservice, endringer, refusjoner og erstatningssaker – <em>avtale</em> og <em>berettiget interesse</em> (art. 6 nr. 1 f).</li>
          <li>Prisvarsler og nyhetsbrev du selv har bedt om – <em>samtykke</em> (art. 6 nr. 1 a), kan trekkes når som helst.</li>
          <li>Bokføring og regnskap – <em>rettslig forpliktelse</em> (art. 6 nr. 1 c, bokføringsloven).</li>
          <li>Sikkerhet, svindelforebygging og feilsøking – <em>berettiget interesse</em>.</li>
        </ul>
      </Section>

      <Section title="4. Databehandlere og mottakere" id="databehandlere">
        <p>Vi deler kun det som er nødvendig for å levere tjenesten, og har databehandleravtaler der loven krever det:</p>
        <ul className="list-disc space-y-1.5 pl-5">
          <li><strong className="text-foreground">Flyselskapet</strong> du reiser med, og <strong className="text-foreground">Duffel</strong> (Storbritannia) som teknisk formidler av bestillingen – passasjer- og kontaktopplysninger.</li>
          <li><strong className="text-foreground">Stripe</strong> (Irland/USA) – betalingsbehandling. Stripe er selvstendig behandlingsansvarlig for kortdata.</li>
          <li><strong className="text-foreground">Railway</strong> – drift og hosting av tjenesten og databasen.</li>
          <li><strong className="text-foreground">E-postleverandør</strong> – utsending av bekreftelser og varsler. <LegalNote>navngi leverandør</LegalNote></li>
          <li>Offentlige myndigheter der loven pålegger oss det.</li>
        </ul>
        <p>
          Overføring til land utenfor EØS (f.eks. Storbritannia og USA) skjer på grunnlag av EU-kommisjonens
          adekvansbeslutninger eller standard personvernbestemmelser (SCC).{" "}
          <LegalNote>verifiser overføringsgrunnlag for hver leverandør</LegalNote>
        </p>
        <p>Vi selger aldri personopplysninger, og deler dem ikke med annonsenettverk.</p>
      </Section>

      <Section title="5. Lagringstid" id="lagring">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Bestillinger, kvitteringer og betalingsreferanser: 5 år etter regnskapsårets slutt (bokføringsloven).</li>
          <li>Passopplysninger: slettes senest 30 dager etter gjennomført reise, med mindre en aktiv sak krever dem.</li>
          <li>Kundeservicesaker: 3 år etter at saken er avsluttet.</li>
          <li>Konto, lagrede reisende og prisvarsler: så lenge kontoen er aktiv. Slettes når du sletter kontoen.</li>
          <li>Tekniske logger: inntil 90 dager.</li>
        </ul>
        <LegalNote>bekreft lagringstidene mot interne rutiner</LegalNote>
      </Section>

      <Section title="6. Informasjonskapsler og lokal lagring" id="cookies">
        <p>
          Vi bruker kun nødvendige informasjonskapsler, blant annet for å holde deg innlogget og for å beskytte
          mot misbruk. Valg som språk, valuta, mørk modus og lagrede favoritt-reisemål lagres lokalt i din egen
          nettleser og forlater ikke enheten din. Vi bruker ikke sporingskapsler fra tredjeparter.
        </p>
      </Section>

      <Section title="7. Dine rettigheter" id="rettigheter">
        <p>
          Du har rett til innsyn, retting, sletting, begrensning og dataportabilitet, og til å protestere mot
          behandling basert på berettiget interesse. Har du konto, kan du{" "}
          <Link to="/profil" className="font-semibold text-foreground underline underline-offset-2">
            eksportere eller slette dataene dine fra profilsiden
          </Link>
          . Ellers sender du en e-post til {COMPANY.privacyEmail}, så svarer vi innen 30 dager. Mener du vi ikke
          behandler opplysningene riktig, kan du klage til Datatilsynet (datatilsynet.no).
        </p>
      </Section>

      <Section title="8. Sikkerhet" id="sikkerhet">
        <p>
          All trafikk er kryptert (TLS). Sensitive felt som passnummer lagres kryptert, tilgang for ansatte er
          rollebasert og krever totrinnsbekreftelse, og all innsyn i kundedata logges.
        </p>
      </Section>

      <Section title="9. Endringer" id="endringer">
        <p>
          Vi oppdaterer denne erklæringen ved behov. Vesentlige endringer varsles på nettsiden eller per e-post
          til registrerte kunder.
        </p>
      </Section>
    </ContentPage>
  );
}
