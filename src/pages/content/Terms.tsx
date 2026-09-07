import { Link } from "react-router";
import ContentPage, { LegalNote, Section } from "./ContentPage";
import { COMPANY } from "./company";
import { articleJsonLd, PAGE_META, usePageMeta } from "@/lib/seo";

const UPDATED = "2026-09-07";

export default function Terms() {
  usePageMeta({
    ...PAGE_META.terms,
    type: "article",
    jsonLd: articleJsonLd({ headline: "Reisevilkår", description: PAGE_META.terms.description, path: "/vilkar", dateModified: UPDATED }),
  });

  return (
    <ContentPage
      eyebrow="Juridisk"
      title="Reisevilkår"
      intro="Disse vilkårene gjelder når du søker etter og bestiller flyreiser gjennom HelloSky. Les dem gjerne før du bestiller — og ta kontakt om noe er uklart."
      updated={UPDATED}
    >
      <Section title="1. Hvem du inngår avtale med" id="avtalepart">
        <p>
          {COMPANY.legalName} ({COMPANY.orgNumberLabel}, {COMPANY.address}) er et norsk reisebyrå som formidler
          flybilletter. Når du bestiller hos oss, kjøper du billetten gjennom oss som mellommann — selve flyreisen
          utføres av flyselskapet, og flyselskapets befordringsvilkår gjelder for gjennomføringen av reisen.
          Flyinnhold og utstedelse leveres teknisk via vår leverandør Duffel.
        </p>
        <LegalNote>bekreft at HelloSky opptrer som formidler/agent, ikke som pakkereisearrangør etter pakkereiseloven</LegalNote>
      </Section>

      <Section title="2. Priser og servicegebyr" id="priser">
        <p>
          Prisen du ser i søkeresultatet og i kjøpsløpet er totalprisen for alle reisende, inkludert skatter og
          avgifter. Totalprisen inneholder også vårt servicegebyr, som er{" "}
          <strong className="text-foreground">{COMPANY.serviceFeePercent} % av flyselskapets pris pluss {COMPANY.serviceFeeFlatNok} kr per bestilling</strong>{" "}
          (tilsvarende beløp i andre valutaer). Gebyret vises som egen linje før du betaler, og dekker blant
          annet kundeservice 06–24, hjelp med endringer og oppfølging dersom noe går galt på reisen.
        </p>
        <p>
          Priser fra flyselskapene kan endre seg frem til betalingen er fullført. Endrer prisen seg mens du holder
          på, får du beskjed og må godkjenne den nye prisen før du betaler — vi belaster aldri et høyere beløp enn
          det du har godkjent. Vi holder ikke av plasser uten betaling.
        </p>
      </Section>

      <Section title="3. Betaling" id="betaling">
        <p>
          Betalingen håndteres av Stripe. Du kan betale med bankkort (Visa, Mastercard) eller med Klarna der det
          er tilgjengelig. Velger du en kredittløsning fra Klarna, gjelder Klarnas egne vilkår, kredittvurdering
          og eventuelle kostnader. HelloSky mottar eller lagrer aldri kortnummer eller sikkerhetskode — dette
          skjer utelukkende hos Stripe.
        </p>
        <p>
          Beløpet reserveres på betalingsmiddelet ditt når du bekrefter, og trekkes først når flyselskapet har
          bekreftet bestillingen. Lykkes ikke bestillingen hos flyselskapet, frigis reservasjonen automatisk.
        </p>
      </Section>

      <Section title="4. Bestilling og bekreftelse" id="bekreftelse">
        <p>
          Når betalingen er fullført og flyselskapet har bekreftet, får du en bekreftelse med bookingreferanse
          og billettnummer på e-post. Bestillingen er ikke bindende for HelloSky før denne bekreftelsen er sendt.
          Sjekk at navnet er stavet nøyaktig som i passet — navneendringer etter utstedelse kan være kostbare
          eller umulige. Kontakt oss med en gang dersom du oppdager en feil.
        </p>
        <p>
          Flybilletter er unntatt fra angreretten etter angrerettloven § 22 bokstav m (persontransport).
        </p>
      </Section>

      <Section title="5. Endring og kansellering" id="kansellering">
        <p>
          Reglene for endring og refusjon bestemmes av flyselskapet og billettypen, og vises på tilbudet før du
          kjøper. «Kan endres» betyr som regel endring mot et gebyr pluss eventuell prisdifferanse; «kan
          refunderes» betyr at flyselskapet betaler tilbake hele eller deler av billettprisen etter sine regler.
          Mange lavprisbilletter kan verken endres eller refunderes.
        </p>
        <p>
          <strong className="text-foreground">Ved kansellering fra din side</strong> refunderer vi det flyselskapet
          faktisk betaler tilbake til oss, i henhold til billettens vilkår. Vårt servicegebyr beholdes, siden
          tjenesten (bestilling og oppfølging) allerede er levert.{" "}
          <strong className="text-foreground">Kansellerer flyselskapet</strong> reisen, refunderes hele beløpet
          inkludert servicegebyret. Refusjoner utbetales til det betalingsmiddelet som ble brukt, normalt innen
          5–10 virkedager etter at flyselskapet har frigitt beløpet.
        </p>
        <p>
          Vi tilbyr ikke egen avbestillingsforsikring eller reiseforsikring. Vi anbefaler at du sjekker
          dekningen i din egen reiseforsikring eller kortforsikring før du bestiller.
        </p>
        <LegalNote>bekreft ordlyden om at servicegebyret beholdes ved kundekansellering, og angreretts-unntaket</LegalNote>
      </Section>

      <Section title="6. Forsinkelser, kanselleringer og ruteendringer" id="forsinkelser">
        <p>
          Blir flyet ditt vesentlig forsinket eller kansellert, kan du ha rett til mat, hotell, ombestilling og
          standarderstatning etter EU-forordning 261/2004. Vi varsler deg når vi får beskjed om ruteendringer, og
          hjelper deg med både ombestilling og erstatningskrav mot flyselskapet. Krav etter forordningen rettes
          mot flyselskapet, ikke HelloSky.
        </p>
      </Section>

      <Section title="7. Reisedokumenter" id="dokumenter">
        <p>
          Det er den reisendes eget ansvar å ha gyldig pass, visum og andre påkrevde dokumenter. Se vår{" "}
          <Link to="/visum" className="font-semibold text-foreground underline underline-offset-2">
            visumguide
          </Link>{" "}
          for generell veiledning — endelige krav får du fra ambassaden eller UDI.
        </p>
      </Section>

      <Section title="8. Ansvar" id="ansvar">
        <p>
          HelloSky er ansvarlig for at bestillingen formidles korrekt til flyselskapet ut fra opplysningene du har
          gitt. Vi er ikke ansvarlige for flyselskapets gjennomføring av reisen, for tap som skyldes feil i
          opplysninger du selv har oppgitt, eller for forhold utenfor vår kontroll.
        </p>
        <LegalNote>ansvarsbegrensning — vurder mot forbrukerkjøpsloven og markedsføringsloven</LegalNote>
      </Section>

      <Section title="9. Tvister" id="tvister">
        <p>
          Norsk rett gjelder. Uenigheter forsøkes løst i minnelighet — kontakt oss først på{" "}
          {COMPANY.supportEmail} eller {COMPANY.supportPhone}. Du kan også bringe saken inn for Forbrukertilsynet
          eller Transportklagenemnda (fly), eller for de ordinære domstolene med Oslo tingrett som
          verneting.
        </p>
      </Section>
    </ContentPage>
  );
}
