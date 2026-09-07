import { Link } from "react-router";
import ContentPage, { Section } from "./ContentPage";
import { faqJsonLd, PAGE_META, usePageMeta } from "@/lib/seo";

const FAQ = [
  { question: "Er håndbagasje inkludert?", answer: "Ja, håndbagasje er inkludert på alle tilbud. Antall kolli vises på hvert tilbud i søkeresultatet." },
  { question: "Hvor mye innsjekket bagasje får jeg med?", answer: "Det vises tydelig på tilbudet før du bestiller. Ekstra kolli kan legges til per reisende i kjøpsløpet, eller i etterkant via kundeservice." },
  { question: "Hva gjør jeg hvis bagasjen er forsinket eller tapt?", answer: "Meld fra ved flyselskapets bagasjedisk før du forlater ankomsthallen og få en PIR-rapport. Vi hjelper med oppfølging og krav etter Montrealkonvensjonen." },
];

export default function Baggage() {
  usePageMeta({ ...PAGE_META.baggage, jsonLd: faqJsonLd(FAQ) });
  return (
    <ContentPage
      eyebrow="Reiseinfo"
      title="Bagasjeguiden"
      intro="Hvor mye bagasje får du med? Det korte svaret: det står på hvert enkelt tilbud før du kjøper. Her er detaljene — og hvordan du legger til mer."
    >
      <Section title="Håndbagasje — alltid inkludert">
        <p>
          Håndbagasje er inkludert på alle tilbudene våre, og antall kolli vises øverst på hvert tilbud i
          søkeresultatet. Mål og vekt varierer mellom flyselskapene — som hovedregel gjelder en koffert i
          kabinen (typisk 55 × 40 × 23 cm) pluss en liten håndveske eller PC-veske. Sjekk flyselskapets egne
          sider for eksakte mål.
        </p>
      </Section>
      <Section title="Innsjekket bagasje">
        <p>
          Antall innsjekkede kolli som er inkludert, vises tydelig på tilbudet før du bestiller — se etter
          koffert-ikonet. På mange langdistanseruter er én koffert inkludert, mens de billigste billettene i
          Europa ofte kun har håndbagasje.
        </p>
        <p>
          Trenger du mer? I kjøpsløpet kan du legge til ekstra kolli per reisende før du betaler. Prisen
          vises før du bestemmer deg. Har du allerede bestilt, kan vi legge til bagasje i etterkant — send
          oss bookingreferansen din via{" "}
          <Link to="/hjelp" className="font-semibold text-foreground underline underline-offset-2">
            hjelpesiden
          </Link>
          .
        </p>
      </Section>
      <Section title="Barn og spedbarn">
        <p>
          Barn med eget sete har som regel samme bagasjekvote som voksne. Spedbarn uten eget sete har ofte
          egne, mer begrensede regler — men barnevogn kan nesten alltid sjekkes inn kostnadsfritt. Reglene
          for ditt tilbud vises i kjøpsløpet.
        </p>
      </Section>
      <Section title="Spesialbagasje">
        <p>
          Ski, snowboard, golfbag og musikkinstrumenter må forhåndsbestilles hos flyselskapet og kan ha egne
          priser. Kontakt oss før avreise, så ordner vi reservasjonen for deg og bekrefter hva det koster.
        </p>
      </Section>
      <Section title="Forsinket eller tapt bagasje">
        <p>
          Meld fra ved flyselskapets bagasjedisk på flyplassen før du forlater ankomsthallen, og få en
          PIR-rapport (Property Irregularity Report). Ta vare på referansenummeret — vi hjelper deg gjerne
          med oppfølgingen og med krav om erstatning etter Montrealkonvensjonen.
        </p>
      </Section>
    </ContentPage>
  );
}
